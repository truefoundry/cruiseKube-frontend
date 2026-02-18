import { useState, useRef, useEffect } from "react";
import { 
  Search, 
  ChevronUp,
  ChevronDown,
  Clock,
  DollarSign,
  AlertTriangle,
  Info,
  Cpu,
  HardDrive,
  Package,
  Database,
  Briefcase,
  CalendarClock,
  Copy,
  CircleDot,
  Box,
  type LucideIcon,
  Eye,
  Settings2,
  Pencil,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient, type Overrides, type WorkloadDetail } from "@/lib/api";
import { 
  FrontendWorkload,
  formatCpu,
  formatMemory,
  formatCpuSigned,
  formatMemorySigned,
  mapPriorityToEvictionRanking,
} from "@/lib/transformers";
import { getResourcePricing } from "@/lib/pricing";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { asArray } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { humanizeWindow } from "@/lib/cronUtils";
import { DisruptionWindowEditor } from "@/components/DisruptionWindowEditor";

const WORKLOAD_TYPE_ICONS: Record<string, LucideIcon> = {
  Deployment: Package,
  StatefulSet: Database,
  DaemonSet: Cpu,
  Job: Briefcase,
  CronJob: CalendarClock,
  ReplicaSet: Copy,
  Pod: CircleDot,
};

function WorkloadTypeIcon({ type }: { type: string }) {
  const Icon = WORKLOAD_TYPE_ICONS[type] ?? Box;
  const displayName = type || "Workload";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center cursor-default" onClick={(e) => e.stopPropagation()}>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{displayName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "low": return "text-destructive";
    case "medium": return "text-warning";
    case "high": return "text-success";
    case "non-evictable": return "text-primary";
    default: return "text-muted-foreground";
  }
}

/** Short format for "X min ago" -> "XM", "X hr ago" -> "XH", "X days ago" -> "XD", "just now" -> "now". */
function formatTimeAgoShort(full: string): string {
  if (!full) return "—";
  if (full === "just now") return "now";
  const minMatch = full.match(/^(\d+)\s*min\s*ago$/i);
  if (minMatch) return `${minMatch[1]}M`;
  const hrMatch = full.match(/^(\d+)\s*hr\s*ago$/i);
  if (hrMatch) return `${hrMatch[1]}H`;
  const dayMatch = full.match(/^(\d+)\s*days?\s*ago$/i);
  if (dayMatch) return `${dayMatch[1]}D`;
  return full;
}

/** Renders short time (e.g. 5M, 2H, 1D) with the unit (m, h, d) in a smaller size. */
function TimeAgoShort({ value }: { value: string }) {
  const short = formatTimeAgoShort(value);
  const match = short.match(/^(\d+)([MHD])$/);
  if (match) {
    const unit = match[2].toLowerCase();
    return (
      <>
        <span>{match[1]}</span>
        <span className="text-[0.65rem] align-sub opacity-90">{unit}</span>
      </>
    );
  }
  return <>{short}</>;
}

/** API expects workload ID with colons; stats may use slashes. */
function workloadIdForApi(id: string): string {
  return id.includes("/") ? id.replace(/\//g, ":") : id;
}

function formatUpdatedAtUnix(utcSeconds: number): string {
  const diffMs = Date.now() - utcSeconds * 1000;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${diffDays} days ago`;
}

function normalizePriority(p: string): "low" | "medium" | "high" | "non-evictable" {
  if (p === "low" || p === "medium" || p === "high" || p === "non-evictable") return p;
  return "medium";
}

function workloadDetailToFrontend(d: WorkloadDetail): FrontendWorkload {
  const mode = d.config.mode === "enabled" ? "enabled" : "recommend-only";
  const priority = normalizePriority(d.config.priority);
  return {
    id: d.workloadID,
    namespace: d.namespace,
    workload: d.name,
    type: d.kind,
    replicas: d.podsCount,
    potentialCpu: d.cpu.recommended.change,
    potentialMem: d.memory.recommended.change,
    currentCpu: formatCpu(d.cpu.current),
    recommendedCpu: formatCpu(d.cpu.recommended.max),
    currentMem: formatMemory(d.memory.current),
    recommendedMem: formatMemory(d.memory.recommended.max),
    potentialDollars: d.dollarSavingsPerMonth,
    reliabilityCostDollars: d.dollarExpenditurePerMonth,
    lastUpdated: formatUpdatedAtUnix(d.updatedAt),
    mode,
    priority,
    hasRecommendations: d.dollarSavingsPerMonth !== 0 || d.dollarExpenditurePerMonth !== 0,
    excluded: d.constraints?.excludedAnnotation ?? false,
    excludedReason: d.constraints?.excludedAnnotation ? "Excluded annotation" : undefined,
  };
}

export default function Workloads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedClusterId } = useCluster();
  const [search, setSearch] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [hasRecommendations, setHasRecommendations] = useState("all");
  const [sortColumn, setSortColumn] = useState<string | null>("potentialDollars");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>("desc");
  const [editWorkload, setEditWorkload] = useState<FrontendWorkload | null>(null);
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high' | 'non-evictable'>('medium');
  const [editMode, setEditMode] = useState<'enabled' | 'recommend-only'>('recommend-only');
  const [editDisruptionWindows, setEditDisruptionWindows] = useState<{ startCron: string; endCron: string }[]>([]);

  const MIN_COLUMN_WIDTH = 48;
  const DEFAULT_COLUMN_WIDTHS = [160, 110, 70, 56, 72, 100, 72, 100, 90, 100, 120];
  const [columnWidths, setColumnWidths] = useState<number[]>(() => DEFAULT_COLUMN_WIDTHS);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  useEffect(() => {
    if (resizingCol === null) return;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (e: MouseEvent) => {
      setColumnWidths((prev) => {
        const next = [...prev];
        const newW = resizeStartWidthRef.current + (e.clientX - resizeStartXRef.current);
        next[resizingCol] = Math.max(MIN_COLUMN_WIDTH, newW);
        return next;
      });
    };
    const onUp = () => {
      setResizingCol(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [resizingCol]);

  const startResize = (colIndex: number, clientX: number) => {
    setResizingCol(colIndex);
    resizeStartXRef.current = clientX;
    resizeStartWidthRef.current = columnWidths[colIndex];
  };

  const updateOverrideMutation = useMutation({
    mutationFn: async ({ workloadId, overrides }: { workloadId: string; overrides: Overrides }) => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.updateWorkloadOverrides(selectedClusterId, workloadId, overrides);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads-summary', selectedClusterId] });
      toast({
        title: "Success",
        description: "CruiseConfig updated successfully",
      });
      setEditWorkload(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update CruiseConfig",
        variant: "destructive",
      });
    },
  });

  const openEditModal = (workload: FrontendWorkload) => {
    setEditWorkload(workload);
    setEditPriority(workload.priority);
    setEditMode(workload.mode);
    setEditDisruptionWindows(workload.disruptionWindows ?? []);
  };

  const handleSaveCruiseConfig = () => {
    if (!editWorkload) return;
    const id = workloadIdForApi(editWorkload.id);
    const overrides: Overrides = {
      eviction_ranking: mapPriorityToEvictionRanking(editPriority),
      enabled: editMode === 'enabled',
    };
    if (editDisruptionWindows.length > 0) {
      overrides.disruption_windows = editDisruptionWindows.map((w) => ({
        start_cron: w.startCron,
        end_cron: w.endCron,
      }));
    }
    updateOverrideMutation.mutate({
      workloadId: id,
      overrides,
    });
  };

  const { data: summaryData, isLoading: isLoadingSummary, error: summaryError } = useQuery({
    queryKey: ['workloads-summary', selectedClusterId],
    queryFn: () => apiClient.getWorkloadsSummary(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const workloads: FrontendWorkload[] = (summaryData?.workloadDetails ?? []).map(workloadDetailToFrontend);
  const impactSummary = summaryData?.impactSummary;
  const clusterResources = impactSummary?.clusterResources;


  const parseCpuValue = (cpuString: string): number => {
    if (!cpuString) return 0;
    const rangeParts = cpuString.split("-");
    const valueToParse = rangeParts.length > 1 ? rangeParts[1].trim() : cpuString;
    if (valueToParse.endsWith("m")) {
      return parseFloat(valueToParse.replace("m", "")) / 1000;
    }
    if (valueToParse.includes("cores")) {
      return parseFloat(valueToParse.replace(" cores", "")) || 0;
    }
    return parseFloat(valueToParse) || 0;
  };

  const parseMemoryValue = (memString: string): number => {
    if (!memString) return 0;
    const rangeParts = memString.split("-");
    const valueToParse = rangeParts.length > 1 ? rangeParts[1].trim() : memString;
    if (valueToParse.endsWith("Mi")) {
      return parseFloat(valueToParse.replace("Mi", "")) || 0;
    }
    if (valueToParse.endsWith("GB")) {
      return (parseFloat(valueToParse.replace(" GB", "")) || 0) * 1024;
    }
    return parseFloat(valueToParse) || 0;
  };

  const parseTimeValue = (timeString: string): number => {
    if (!timeString) return 0;
    if (timeString === "just now") return 0;
    const minsMatch = timeString.match(/(\d+) min ago/);
    if (minsMatch) return parseInt(minsMatch[1]) || 0;
    const hoursMatch = timeString.match(/(\d+) hr ago/);
    if (hoursMatch) return (parseInt(hoursMatch[1]) || 0) * 60;
    const daysMatch = timeString.match(/(\d+) days ago/);
    if (daysMatch) return (parseInt(daysMatch[1]) || 0) * 1440;
    return 0;
  };

  const formatCpuValue = (value: string | null): string => {
    if (!value) return "N/A";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "N/A";
    return `${numValue.toFixed(2)} cores`;
  };

  const formatMemoryValue = (value: string | null): string => {
    if (!value) return "N/A";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "N/A";
    return `${numValue.toFixed(2)} GB`;
  };

  const sortWorkloads = (workloads: FrontendWorkload[]): FrontendWorkload[] => {
    const list = workloads ?? [];
    if (!sortColumn || !sortDirection) {
      return list;
    }

    const sorted = [...list].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case "namespace":
        case "workload":
        case "type":
        case "mode":
        case "priority":
          aValue = a[sortColumn as keyof FrontendWorkload] as string;
          bValue = b[sortColumn as keyof FrontendWorkload] as string;
          if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
          if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
          return 0;

        case "replicas":
        case "potentialDollars":
        case "reliabilityCostDollars":
          aValue = a[sortColumn as keyof FrontendWorkload] as number;
          bValue = b[sortColumn as keyof FrontendWorkload] as number;
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "netSavings": {
          const aNet = a.potentialDollars - a.reliabilityCostDollars;
          const bNet = b.potentialDollars - b.reliabilityCostDollars;
          return sortDirection === "asc" ? aNet - bNet : bNet - aNet;
        }

        case "cruiseConfig": {
          const modeOrder = (m: string) => (m === "enabled" ? 1 : 0);
          const priorityOrder = (p: string) => ({ "non-evictable": 3, high: 2, medium: 1, low: 0 }[p] ?? -1);
          const aMode = modeOrder(a.mode);
          const bMode = modeOrder(b.mode);
          if (aMode !== bMode) return sortDirection === "asc" ? aMode - bMode : bMode - aMode;
          const aPri = priorityOrder(a.priority);
          const bPri = priorityOrder(b.priority);
          return sortDirection === "asc" ? aPri - bPri : bPri - aPri;
        }

        case "currentCpu":
        case "recommendedCpu":
          aValue = parseCpuValue(a[sortColumn as keyof FrontendWorkload] as string);
          bValue = parseCpuValue(b[sortColumn as keyof FrontendWorkload] as string);
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "potentialCpu":
          aValue = a.potentialCpu;
          bValue = b.potentialCpu;
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "currentMem":
        case "recommendedMem":
          aValue = parseMemoryValue(a[sortColumn as keyof FrontendWorkload] as string);
          bValue = parseMemoryValue(b[sortColumn as keyof FrontendWorkload] as string);
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "potentialMem":
          aValue = a.potentialMem;
          bValue = b.potentialMem;
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "lastUpdated":
          aValue = parseTimeValue(a.lastUpdated);
          bValue = parseTimeValue(b.lastUpdated);
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        default:
          return 0;
      }
    });

    return sorted;
  };

  const filteredWorkloads = asArray(workloads).filter((w) => {
    const matchesSearch = 
      w.workload.toLowerCase().includes(search.toLowerCase()) ||
      w.namespace.toLowerCase().includes(search.toLowerCase());
    const matchesNamespace = namespaceFilter === "all" || w.namespace === namespaceFilter;
    const matchesMode = modeFilter === "all" || w.mode === modeFilter;
    const matchesPriority = priorityFilter === "all" || w.priority === priorityFilter;
    const matchesRecommendations = hasRecommendations === "all" || 
      (hasRecommendations === "yes" && w.hasRecommendations) ||
      (hasRecommendations === "no" && !w.hasRecommendations);
    return matchesSearch && matchesNamespace && matchesMode && matchesPriority && matchesRecommendations;
  });

  const sortedWorkloads = sortWorkloads(filteredWorkloads);

  const namespaces = [...new Set(asArray(workloads).map((w) => w.namespace))];

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else if (sortDirection === "asc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  if (!selectedClusterId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please select a cluster to view workloads.
        </div>
      </div>
    );
  }

  const isLoadingMetrics = isLoadingSummary;

  if (summaryError) {
    const errorMessage = summaryError instanceof Error ? summaryError.message : "Unknown error";
    return (
      <div className="p-6 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error loading workloads</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const costOptimizedWorkloads = (summaryData?.workloadDetails ?? []).filter((w) => w.config.mode === "enabled" && w.dollarSavingsPerMonth > 0).length;
  const costOptimizedWorkloadsRecommendOnly = (summaryData?.workloadDetails ?? []).filter((w) => w.config.mode !== "enabled" && w.dollarSavingsPerMonth > 0).length;
  const reliabilityIssues = (summaryData?.workloadDetails ?? []).filter((w) => w.dollarExpenditurePerMonth > 0).length;
  const overviewMetrics = {
    costOptimizedWorkloads,
    costOptimizedWorkloadsRecommendOnly,
    reliabilityIssues,
  };

  const hasNoData = !isLoadingMetrics && (summaryData?.workloadDetails?.length ?? 0) === 0;

  const currentCostDollars = impactSummary?.dollarCurrentCost ?? 0;
  const currentSavingsDollars = impactSummary?.dollarCurrentSavings ?? 0;
  const possibleSavingsDollars = impactSummary?.dollarPossibleSavings ?? 0;
  const workloadCostDollars = currentCostDollars + currentSavingsDollars;
  const optimizedCostDollars = workloadCostDollars - possibleSavingsDollars;

  const pricing = getResourcePricing();
  const isDev = import.meta.env.DEV;
  const cpuAllocatable = clusterResources?.cpu?.allocatable ?? 0;
  const memAllocatable = clusterResources?.memory?.allocatable ?? 0;

  const currentCostTooltipContent = (
    <div className="space-y-3 text-left">
      <p className="font-medium text-foreground">Current cost</p>
      <p className="text-xs text-muted-foreground">
        Algorithm: (allocatable CPU cores × CPU $/hr + allocatable memory GB × memory $/hr) × 720 hours/month. Prices are from Policies → Resource Pricing.
      </p>
      {isDev && (
        <>
          <p className="text-xs font-medium text-foreground pt-1 border-t border-border">Values used</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 font-mono">
            <li>CPU allocatable: {cpuAllocatable.toFixed(2)} cores</li>
            <li>Memory allocatable: {memAllocatable.toFixed(2)} GB</li>
            <li>CPU price: ${pricing.cpuPerCorePerHour}/hr</li>
            <li>Memory price: ${pricing.memoryPerGbPerHour}/hr</li>
            <li>Hours per month: 720</li>
          </ul>
          <p className="text-xs pt-1 border-t border-border font-mono text-foreground">
            Result: ${currentCostDollars.toLocaleString()}/month
          </p>
        </>
      )}
    </div>
  );

  const currentSavingsTooltipContent = (
    <div className="space-y-3 text-left">
      <p className="font-medium text-foreground">Current savings</p>
      <p className="text-xs text-muted-foreground">
      Algorithm: workload cost − current cost. 
      <br/><br/>
        Req_alloc_ratio = Prometheus requested ÷ Prometheus allocatable (per resource).
        <br/><br/>
        Workload cost = (original requested resources from workload ÷ Req_alloc_ratio) × price × 720. 
        <br/><br/>
        Current cost = allocatable × price × 720. 

        <br/ ><br/>

        So current savings = what the requested workloads would cost (normalized by ratio) minus what you pay today (allocatable).
      </p>
      {isDev && (
        <>
          <p className="text-xs font-medium text-foreground pt-1 border-t border-border">Values used</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 font-mono">
            <li>Workload cost: ${workloadCostDollars.toLocaleString()}/month</li>
            <li>Current cost: ${currentCostDollars.toLocaleString()}/month</li>
          </ul>
          <p className="text-xs pt-1 border-t border-border font-mono text-foreground">
            Result: ${workloadCostDollars.toLocaleString()} − ${currentCostDollars.toLocaleString()} = ${currentSavingsDollars.toLocaleString()}/month
          </p>
        </>
      )}
    </div>
  );

  const possibleSavingsTooltipContent = (
    <div className="space-y-3 text-left">
      <p className="font-medium text-foreground">Possible savings</p>
      <p className="text-xs text-muted-foreground">
        Algorithm: workload cost − optimized cost. 
        <br/><br/>
        Optimized cost = (recommended request ÷ Req_alloc_ratio) × price × 720. 
        <br/><br/>
        Workload cost = (original requested ÷ Req_alloc_ratio) × price × 720. 
      </p>
      {isDev && (
        <>
          <p className="text-xs font-medium text-foreground pt-1 border-t border-border">Values used</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 font-mono">
            <li>Workload cost: ${workloadCostDollars.toLocaleString()}/month</li>
            <li>Optimized cost: ${optimizedCostDollars.toLocaleString()}/month</li>
          </ul>
          <p className="text-xs pt-1 border-t border-border font-mono text-foreground">
            Result: ${workloadCostDollars.toLocaleString()} − ${optimizedCostDollars.toLocaleString()} = ${possibleSavingsDollars.toLocaleString()}/month
          </p>
        </>
      )}
    </div>
  );

  return (
    <div className="min-w-0 w-full max-w-full animate-fade-in">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {/* Alert: no data */}
        {hasNoData && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400 rounded-xl">
            <Info className="h-4 w-4" />
            <AlertTitle>No workload data available</AlertTitle>
            <AlertDescription>
              No workload or stats data was returned for this cluster. The cluster may have no workloads yet, or the data sync may not have completed. Try refreshing the page or selecting another cluster.
            </AlertDescription>
          </Alert>
        )}

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Workloads</h1>
            <p className="mt-1 text-sm text-muted-foreground">Optimized Kubernetes resources and cost impact</p>
          </div>
          {summaryData?.workloadDetails && summaryData.workloadDetails.length > 0 && (() => {
            const maxUpdated = Math.max(...summaryData.workloadDetails.map((w) => w.updatedAt), 0);
            return maxUpdated > 0 ? (
              <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Last sync: {new Date(maxUpdated * 1000).toLocaleString()}
              </div>
            ) : null;
          })()}
        </header>

        {/* Cost & impact — 3 cards */}
        <section aria-labelledby="cost-impact-heading">
          <h2 id="cost-impact-heading" className="sr-only">Cost & impact</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {/* 1. Current cost: allocatable × cost */}
            <div className="metric-card border-border">
              {isLoadingMetrics ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current cost</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none" onClick={(e) => e.stopPropagation()} aria-label="How current cost is calculated">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
                            {currentCostTooltipContent}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      ${currentCostDollars.toLocaleString()}
                      <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
                    </p>
                    <p className="text-sm text-muted-foreground">Allocatable × cost (CPU + Memory)</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Current savings: workload cost − current cost */}
            <div className="metric-card border-border">
              {isLoadingMetrics ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current savings</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none" onClick={(e) => e.stopPropagation()} aria-label="How current savings is calculated">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
                            {currentSavingsTooltipContent}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      ${currentSavingsDollars.toLocaleString()}
                      <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
                    </p>
                    <p className="text-sm text-muted-foreground">You are currently saving this amount per month</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Possible savings: workload cost − optimized cost; % below vs workload cost */}
            <div className="metric-card border-border flex flex-col">
              {isLoadingMetrics ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between flex-1 min-h-0">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Possible savings</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none shrink-0" aria-label="How possible savings is calculated">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
                              {possibleSavingsTooltipContent}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                        ${possibleSavingsDollars.toLocaleString()}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground shrink-0">
                      <DollarSign className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Total possible savings per month</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Cluster resources */}
        <section aria-labelledby="cluster-resources-heading">
          <h2 id="cluster-resources-heading" className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cluster resources</h2>
          <div className="grid gap-4 md:grid-cols-2">
        {isLoadingMetrics ? (
          <>
            <div className="metric-card space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="metric-card space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </>
        ) : (
          <>
            {/* CPU: single stacked bar (Utilised | Requested−Utilised | Free) */}
            <div className="metric-card border-border">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CPU</span>
                </div>
                <span className="font-mono text-sm font-semibold">{formatCpuValue((clusterResources?.cpu?.allocatable != null ? String(clusterResources.cpu.allocatable) : null) ?? null)} allocatable</span>
              </div>
              {(() => {
                const alloc = Number((clusterResources?.cpu?.allocatable != null ? String(clusterResources.cpu.allocatable) : null) ?? 0);
                const used = Number((clusterResources?.cpu?.utilised != null ? String(clusterResources.cpu.utilised) : null) ?? 0);
                const req = Number((clusterResources?.cpu?.requested != null ? String(clusterResources.cpu.requested) : null) ?? 0);
                const pctUsed = alloc > 0 ? Math.min(100, (used / alloc) * 100) : 0;
                const pctReserved = alloc > 0 ? Math.min(100 - pctUsed, (Math.max(0, req - used) / alloc) * 100) : 0;
                const pctFree = Math.max(0, 100 - pctUsed - pctReserved);
                return (
                  <>
                    <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted/60">
                      {pctUsed > 0 && <div className="h-full bg-primary transition-all" style={{ width: `${pctUsed}%` }} title={`Utilised: ${formatCpuValue((clusterResources?.cpu?.utilised != null ? String(clusterResources.cpu.utilised) : null) ?? null)}`} />}
                      {pctReserved > 0 && <div className="h-full bg-primary/50 transition-all" style={{ width: `${pctReserved}%` }} title={`Requested (unused): ${(req - used).toFixed(2)} cores`} />}
                      {pctFree > 0 && <div className="h-full flex-1 bg-transparent" style={{ width: `${pctFree}%` }} title="Free" />}
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>Utilised <span className="text-foreground">{formatCpuValue((clusterResources?.cpu?.utilised != null ? String(clusterResources.cpu.utilised) : null) ?? null)}</span></span>
                    <span>Requested <span className="text-foreground">{formatCpuValue((clusterResources?.cpu?.requested != null ? String(clusterResources.cpu.requested) : null) ?? null)}</span></span>
                    </div>
                  </>
                );
              })()}
            </div>
            {/* Memory: single stacked bar */}
            <div className="metric-card border-border">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Memory</span>
                </div>
                <span className="font-mono text-sm font-semibold">{formatMemoryValue((clusterResources?.memory?.allocatable != null ? String(clusterResources.memory.allocatable) : null) ?? null)} allocatable</span>
              </div>
              {(() => {
                const alloc = Number((clusterResources?.memory?.allocatable != null ? String(clusterResources.memory.allocatable) : null) ?? 0);
                const used = Number((clusterResources?.memory?.utilised != null ? String(clusterResources.memory.utilised) : null) ?? 0);
                const req = Number((clusterResources?.memory?.requested != null ? String(clusterResources.memory.requested) : null) ?? 0);
                const pctUsed = alloc > 0 ? Math.min(100, (used / alloc) * 100) : 0;
                const pctReserved = alloc > 0 ? Math.min(100 - pctUsed, (Math.max(0, req - used) / alloc) * 100) : 0;
                const pctFree = Math.max(0, 100 - pctUsed - pctReserved);
                return (
                  <>
                    <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted/60">
                      {pctUsed > 0 && <div className="h-full bg-primary transition-all" style={{ width: `${pctUsed}%` }} title={`Utilised: ${formatMemoryValue((clusterResources?.memory?.utilised != null ? String(clusterResources.memory.utilised) : null) ?? null)}`} />}
                      {pctReserved > 0 && <div className="h-full bg-primary/50 transition-all" style={{ width: `${pctReserved}%` }} title={`Requested (unused): ${(req - used).toFixed(2)} GB`} />}
                      {pctFree > 0 && <div className="h-full flex-1 bg-transparent" style={{ width: `${pctFree}%` }} title="Free" />}
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>Utilised <span className="text-foreground">{formatMemoryValue((clusterResources?.memory?.utilised != null ? String(clusterResources.memory.utilised) : null) ?? null)}</span></span>
                      <span>Requested <span className="text-foreground">{formatMemoryValue((clusterResources?.memory?.requested != null ? String(clusterResources.memory.requested) : null) ?? null)}</span></span>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
          </div>
        </section>

        {/* Workload list */}
        <section aria-labelledby="workloads-heading">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 id="workloads-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Workload list
              {sortedWorkloads.length > 0 && (
                <span className="ml-2 font-normal normal-case text-foreground">({sortedWorkloads.length})</span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 text-sm bg-muted/30 border-border rounded-md"
                />
              </div>
              <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
                <SelectTrigger className="h-9 w-[140px] bg-muted/30 border-border rounded-md text-sm">
                  <SelectValue placeholder="Namespace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All namespaces</SelectItem>
                  {asArray(namespaces).map((ns) => (
                    <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="h-9 w-[120px] bg-muted/30 border-border rounded-md text-sm">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modes</SelectItem>
                  <SelectItem value="enabled">Cruise</SelectItem>
                  <SelectItem value="recommend-only">Recommend</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-muted/30 border-border rounded-md text-sm">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="non-evictable">Non-evictable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
            {/* Workload summary — integrated bar above table */}
            <div className="border-b border-border bg-muted/30 px-4 py-3">
              {isLoadingMetrics ? (
                <div className="flex flex-wrap items-center gap-6">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
                  {/* <div className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">{asArray(workloads).length}</span>
                  </div> */}
                  {/* <div className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground">Skipped</span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {Math.max(0, asArray(workloads).length - overviewMetrics.costOptimizedWorkloadsRecommendOnly - overviewMetrics.costOptimizedWorkloads)}
                    </span>
                  </div> */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground">Optimized/Cruise</span>
                    {/* <span className="font-mono tabular-nums text-foreground">${overviewMetrics.realizedDollars.toLocaleString()}/mo</span> */}
                    {/* <span className="font-mono tabular-nums text-foreground text-muted-foreground">·</span> */}
                    <span className="font-mono font-semibold tabular-nums text-foreground">{overviewMetrics.costOptimizedWorkloads}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground">Recommended</span>
                    {/* <span className="font-mono tabular-nums text-foreground">${overviewMetrics.unrealizedDollars.toLocaleString()}/mo</span> */}
                    {/* <span className="font-mono tabular-nums text-foreground text-muted-foreground">·</span> */}
                    <span className="font-mono font-semibold tabular-nums text-foreground">{overviewMetrics.costOptimizedWorkloadsRecommendOnly}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground">Reliability Improved</span>
                    {/* <span className="font-mono tabular-nums text-foreground">${overviewMetrics.reliabilityIncreaseCost.dollars.toLocaleString()}/mo</span> */}
                    {/* <span className="font-mono tabular-nums text-foreground text-muted-foreground">·</span> */}
                    <span className="font-mono font-semibold tabular-nums text-foreground">{overviewMetrics.reliabilityIssues}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              {columnWidths.map((w, i) => (
                <col key={i} style={{ width: w, minWidth: MIN_COLUMN_WIDTH }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border">
              <tr>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("workload"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Workload
                    {sortColumn === "workload" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(0, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("namespace"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Namespace
                    {sortColumn === "namespace" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(1, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("lastUpdated"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Updated
                    {sortColumn === "lastUpdated" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(2, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4 relative w-20"
                  onClick={(e) => { e.stopPropagation(); handleSort("replicas"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Pods
                    {sortColumn === "replicas" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(3, e.clientX); }} aria-hidden />
                </th>
                <th colSpan={2} className="border-t border-l border-r border-b-0 border-border bg-muted/40 text-center font-medium align-top pt-3 pb-0 px-0">
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu className="h-4 w-4" />
                    CPU
                  </span>
                </th>
                <th colSpan={2} className="border-t border-l border-r border-b-0 border-border bg-muted/40 text-center font-medium align-top pt-3 pb-0 px-0">
                  <span className="inline-flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4" />
                    Memory
                  </span>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("netSavings"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Net Savings/M
                    {sortColumn === "netSavings" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>Possible savings from resource reductions minus cost of increasing resources for reliability. ✓ = reliability was improved (resources recommended to be increased).</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(8, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("cruiseConfig"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    CruiseConfig
                    {sortColumn === "cruiseConfig" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Mode: enables auto-apply of recommendations. Priority: eviction order during optimization (higher = less likely to be evicted).</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(9, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2} className="relative">
                  Actions
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(10, e.clientX); }} aria-hidden />
                </th>
              </tr>
              <tr>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-l border-border bg-muted/30 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("currentCpu"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Current
                    {sortColumn === "currentCpu" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(4, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-r border-border bg-muted/30 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("recommendedCpu"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Recommended
                    {sortColumn === "recommendedCpu" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(5, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-l border-border bg-muted/30 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("currentMem"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Current
                    {sortColumn === "currentMem" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(6, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-r border-border bg-muted/30 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("recommendedMem"); }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    Recommended
                    {sortColumn === "recommendedMem" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(7, e.clientX); }} aria-hidden />
                </th>
              </tr>
            </thead>
            <tbody>
              {asArray(sortedWorkloads).map((workload, index) => (
                <tr
                  key={workload.id}
                  className={`group transition-colors ${
                    workload.excluded
                      ? "opacity-60 bg-muted/40 border-l-2 border-l-muted-foreground/40 hover:bg-muted/50"
                      : "hover:bg-muted/50 " + (index % 2 === 1 ? "bg-muted/10" : "")
                  }`}
                >
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <WorkloadTypeIcon type={workload.type} />
                        </span>
                        <span className={`font-medium whitespace-nowrap ${workload.excluded ? "text-muted-foreground" : ""}`}>{workload.workload}</span>
                        {workload.excluded && (
                          <Badge variant="secondary" className="text-xs font-normal bg-muted text-muted-foreground border border-border">
                            Excluded
                          </Badge>
                        )}
                      </div>
                      {workload.excluded && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {workload.excludedReason || "Excluded from optimization"}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="font-mono text-xs">{workload.namespace}</td>
                  <td className="text-muted-foreground text-xs">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-default">
                            <Clock className="h-3 w-3 shrink-0" />
                            <TimeAgoShort value={workload.lastUpdated} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{workload.lastUpdated || "—"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="font-mono text-sm tabular-nums text-right">{workload.replicas}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-l border-b border-border ${index === 0 ? "border-t" : ""}`}>{workload.currentCpu}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-r border-b border-border ${index === 0 ? "border-t" : ""}`}>
                    {workload.recommendedCpu}
                    {workload.potentialCpu !== 0 && (
                      <span className={workload.potentialCpu > 0 ? "text-amber-600 dark:text-amber-400" : ""}> ({formatCpuSigned(workload.potentialCpu)})</span>
                    )}
                  </td>
                  <td className={`font-mono text-sm bg-muted/20 border-l border-b border-border ${index === 0 ? "border-t" : ""}`}>{workload.currentMem}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-r border-b border-border ${index === 0 ? "border-t" : ""}`}>
                    {workload.recommendedMem}
                    {workload.potentialMem !== 0 && (
                      <span className={workload.potentialMem > 0 ? "text-amber-600 dark:text-amber-400" : ""}> ({formatMemorySigned(workload.potentialMem)})</span>
                    )}
                  </td>
                  <td className="font-mono text-sm">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1.5 cursor-default">
                            {(() => {
                              const net = workload.potentialDollars - workload.reliabilityCostDollars;
                              const hasReliability = workload.reliabilityCostDollars > 0;
                              const display = net === 0 && !hasReliability ? "—" : (net >= 0 ? `$${net.toFixed(2)}` : `-$${Math.abs(net).toFixed(2)}`);
                              return (
                                <>
                                  <span className={net > 0 ? "text-primary" : net < 0 ? "text-destructive" : "text-muted-foreground"}>{display}</span>
                                  {hasReliability && (
                                    <Check className="h-3.5 w-3.5 text-success shrink-0" aria-label="Reliability improved" />
                                  )}
                                </>
                              );
                            })()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>Net = Possible savings − cost of reliability increases. {workload.reliabilityCostDollars > 0 ? "✓ This workload had reliability improved (resources recommended to be increased)." : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-xs font-medium ${workload.mode === "enabled" ? "text-success" : "text-muted-foreground"}`}>
                          {workload.mode === "enabled" ? "Cruise" : "Recommend"}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className={`text-xs font-medium capitalize ${getPriorityColor(workload.priority)}`}>
                          {workload.priority}
                        </span>
                        {asArray(workload.disruptionWindows).length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground cursor-default border-b border-dotted border-muted-foreground/50">
                                  {workload.disruptionWindows!.length} window{workload.disruptionWindows!.length !== 1 ? "s" : ""}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm">
                                <div className="space-y-1">
                                  {workload.disruptionWindows!.map((w, i) => (
                                    <p key={i} className="text-xs">
                                      {humanizeWindow(w.startCron, w.endCron)}
                                    </p>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => navigate(`/workloads/${workload.namespace}/${workload.workload}`)}
                        disabled={workload.excluded}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View Pods
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => openEditModal(workload)}
                              disabled={workload.excluded}
                              aria-label="Edit CruiseConfig"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit CruiseConfig</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sortedWorkloads.length === 0 && (
          <div className="rounded-xl border border-border bg-card/30 py-16 text-center text-sm text-muted-foreground">
            No workloads match your filters
          </div>
        )}

        {/* Edit CruiseConfig modal */}
        <Dialog open={!!editWorkload} onOpenChange={(open) => !open && setEditWorkload(null)}>
          <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Edit CruiseConfig</DialogTitle>
              <DialogDescription>
                {editWorkload && (
                  <>Update priority, mode, and disruption windows for <span className="font-medium text-foreground">{editWorkload.workload}</span> in <span className="font-mono text-foreground">{editWorkload.namespace}</span>.</>
                )}
              </DialogDescription>
            </DialogHeader>
            {editWorkload && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={editPriority} onValueChange={(v) => setEditPriority(v as typeof editPriority)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="non-evictable">Non-evictable</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Determines eviction priority during optimization.</p>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Mode</label>
                  <Select value={editMode} onValueChange={(v) => setEditMode(v as typeof editMode)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recommend-only">Recommend only</SelectItem>
                      <SelectItem value="enabled">Cruise (auto-apply)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Cruise auto-applies recommendations; Recommend only shows suggestions.</p>
                </div>
                <DisruptionWindowEditor
                  windows={editDisruptionWindows}
                  onChange={setEditDisruptionWindows}
                  disabled={updateOverrideMutation.isPending}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditWorkload(null)}>Cancel</Button>
              <Button onClick={handleSaveCruiseConfig} disabled={updateOverrideMutation.isPending}>
                {updateOverrideMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </section>
      </div>
    </div>
  );
}

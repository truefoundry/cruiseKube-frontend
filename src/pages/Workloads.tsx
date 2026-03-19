import { ReactNode, useEffect, useRef, useState } from "react";
import { 
  Search,
  ChevronUp,
  ChevronDown,
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
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  BarChart2,
  Shrink,
  Ban,
  Clock,
  List,
  LockKeyhole,
  Shield,
  DollarSign,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleArrowUp } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient, type Overrides, type WorkloadDetail, EXCLUDED_CODE_LABELS } from "@/lib/api";
import { 
  FrontendWorkload,
  formatCpu,
  formatCpuSigned,
  formatMemory,
  formatMemorySigned,
  mapCriticalToEvictionRanking,
} from "@/lib/transformers";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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

function WorkloadStatusIcons({ workload }: { workload: FrontendWorkload }) {
  const isGpuWorkload = workload.isGpuWorkload === true || (workload.excluded && workload.excludedReason?.toLowerCase().includes("gpu"));
  return (
    <span className="inline-flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      {workload.excluded && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-muted-foreground">
                <Ban className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">Excluded</p>
              <p className="mt-1 text-muted-foreground">
                {workload.excludedReason || "Excluded from optimization."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {workload.hpaEnabled && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-amber-600 dark:text-amber-400">
                <BarChart2 className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">HPA enabled</p>
              <p className="mt-1 text-muted-foreground">
                This workload has Horizontal Pod Autoscaler (HPA) on CPU or memory. Cruise is disabled for HPA workloads.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {workload.scaledDown && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-blue-600 dark:text-blue-400">
                <Shrink className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">Scaled down</p>
              <p className="mt-1 text-muted-foreground">
                This workload has been scaled down to 0 replicas.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {isGpuWorkload && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-violet-500 dark:text-violet-400">
                <Cpu className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">GPU workload</p>
              <p className="mt-1 text-muted-foreground">
                This workload is identified as a GPU workload. {workload.excluded ? "It is excluded from optimization because it uses GPU resources." : "It may be excluded from optimization when it uses GPU resources."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {workload.blockingConsolidationPdb && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-amber-600 dark:text-amber-400">
                <LockKeyhole className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">Has PDB</p>
              <p className="mt-1 text-muted-foreground">
                This workload will block consolidation of nodes because of its Pod Disruption Budget (PDB). Set up a disruption window in Edit CruiseConfig so that nodes can consolidate during the window.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {workload.blockingConsolidationDoNotDisrupt && !workload.inDisruptionWindow && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-amber-600 dark:text-amber-400">
                <Shield className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">Do-not-disrupt</p>
              <p className="mt-1 text-muted-foreground">
                This workload will block consolidation of nodes because of its do-not-disrupt annotation. Set up a disruption window in Edit CruiseConfig so that nodes can consolidate during the window.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {workload.blockingConsolidation && workload.inDisruptionWindow && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-success">
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">In disruption window</p>
              <p className="mt-1 text-muted-foreground">
                This workload is currently inside a disruption window. Do-not-disrupt annotations are temporarily removed to allow node consolidation.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {workload.blockingConsolidation && !workload.inDisruptionWindow && !workload.blockingConsolidationPdb && !workload.blockingConsolidationDoNotDisrupt && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p className="font-semibold">Blocks node consolidation</p>
              <p className="mt-1 text-muted-foreground">
                This workload blocks consolidation of nodes. Set up a disruption window in Edit CruiseConfig so that nodes can consolidate during the window.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}

/** True when workload should be disabled for Cruise (excluded, GPU, or HPA). */
function isWorkloadDisabled(workload: FrontendWorkload): boolean {
  return !!(workload.excluded || workload.isGpuWorkload || workload.hpaEnabled);
}

function getCriticalColor(critical: string): string {
  switch (critical) {
    case "low": return "text-destructive";
    case "medium": return "text-warning";
    case "high": return "text-success";
    case "very-high": return "text-primary";
    case "excluded": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

/** API expects workload ID with colons; stats may use slashes. */
function workloadIdForApi(id: string): string {
  return id.includes("/") ? id.replace(/\//g, ":") : id;
}

/** Short relative time for table display (e.g. "now", "5m", "2h", "3d"). */
function formatUpdatedAtShort(utcSeconds: number): string {
  const diffMs = Date.now() - utcSeconds * 1000;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

/** Full date/time for tooltip. */
function formatUpdatedAtFull(utcSeconds: number): string {
  try {
    const d = new Date(utcSeconds * 1000);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function normalizeCritical(p: string): "low" | "medium" | "high" | "very-high" {
  if (p === "low" || p === "medium" || p === "high" || p === "very-high") return p;
  return "medium";
}

function workloadDetailToFrontend(d: WorkloadDetail): FrontendWorkload {
  const mode = d.config.cruiseEnabled ? "enabled" : "recommend-only";
  const critical = normalizeCritical(d.config.criticalityLevel);
  const c = d.constraints;
  return {
    id: d.workloadID,
    namespace: d.namespace,
    workload: d.name,
    type: d.kind,
    replicas: d.podsCount,
    potentialCpu: d.cpu.recommended.change,
    potentialMem: d.memory.recommended.change,
    currentCpu: formatCpu(d.cpu.current),
    recommendedCpu: formatCpu(d.cpu.recommended.avg),
    currentMem: formatMemory(d.memory.current),
    recommendedMem: formatMemory(d.memory.recommended.avg),
    potentialDollars: d.dollarSavingsPerMonth,
    reliabilityCostDollars: d.dollarExpenditurePerMonth,
    lastUpdated: formatUpdatedAtShort(d.updatedAt),
    updatedAt: d.updatedAt,
    mode,
    critical,
    hasRecommendations: d.dollarSavingsPerMonth !== 0 || d.dollarExpenditurePerMonth !== 0,
    excluded: c?.excludedAnnotation ?? false,
    excludedReason: c?.excludedAnnotation ? "Excluded annotation" : undefined,
    disruptionWindows: (d.config.disruptionSchedule ?? []).map((w) => ({
      startCron: w.windowStartCron,
      endCron: w.windowEndCron,
    })),
    blockingConsolidation: c?.blockingConsolidation ?? false,
    blockingConsolidationPdb: c?.pdb ?? false,
    blockingConsolidationDoNotDisrupt: c?.doNotDisruptAnnotation ?? false,
    inDisruptionWindow: d.config.inDisruptionWindow ?? false,
    isGpuWorkload: c?.isGPUWorkload ?? false,
    hpaEnabled: d.config.hpaEnabled ?? false,
    excludedCodes: (d.config.excludedCodes?.length ?? 0) > 0 ? d.config.excludedCodes : undefined,
    scaledDown: d.scaledDown ?? false,
  };
}

function InfoTooltip({
  label,
  children,
  contentClassName = "max-w-xs",
}: {
  label: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="inline-flex shrink-0 text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label={label}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={contentClassName}>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Workloads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedClusterId } = useCluster();
  const [search, setSearch] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [criticalFilter, setCriticalFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "excluded" | "blocking-consolidation" | "gpu" | "hpa-enabled" | "scaled-down"
  >("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [hasRecommendations, setHasRecommendations] = useState("all");
  const [sortColumn, setSortColumn] = useState<string | null>("potentialDollars");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>("desc");
  const [editWorkload, setEditWorkload] = useState<FrontendWorkload | null>(null);
  const [editCritical, setEditCritical] = useState<'low' | 'medium' | 'high' | 'very-high'>('medium');
  const [editMode, setEditMode] = useState<'enabled' | 'recommend-only'>('recommend-only');
  const [editDisruptionWindows, setEditDisruptionWindows] = useState<{ startCron: string; endCron: string }[]>([]);
  const [selectedWorkloadIds, setSelectedWorkloadIds] = useState<Set<string>>(new Set());

  const MIN_COLUMN_WIDTH = 40;
  const DEFAULT_COLUMN_WIDTHS = [30, 40, 290, 130, 40, 90, 120, 90, 120, 100, 80, 80, 100];
  const [columnWidths, setColumnWidths] = useState<number[]>(() => DEFAULT_COLUMN_WIDTHS);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const tableScrollRef = useRef<HTMLDivElement>(null);

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

  const batchOverridesMutation = useMutation({
    mutationFn: async ({ workloadIds, enabled }: { workloadIds: string[]; enabled: boolean }) => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.batchWorkloadOverrides(selectedClusterId, workloadIds, { enabled });
    },
    onSuccess: (_, { workloadIds, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['workloads-summary', selectedClusterId] });
      setSelectedWorkloadIds(new Set());
      toast({
        title: "Success",
        description: `Cruise ${enabled ? "enabled" : "disabled"} for ${workloadIds.length} workload${workloadIds.length !== 1 ? "s" : ""}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update workloads",
        variant: "destructive",
      });
    },
  });

  const openEditModal = (workload: FrontendWorkload) => {
    setEditWorkload(workload);
    setEditCritical(workload.critical);
    setEditMode(workload.mode);
    setEditDisruptionWindows(workload.disruptionWindows ?? []);
  };

  const handleModeToggle = (workload: FrontendWorkload) => {
    if (isWorkloadDisabled(workload)) return;
    const newMode = workload.mode === "enabled" ? "recommend-only" : "enabled";
    const overrides: Overrides = {
      eviction_ranking: mapCriticalToEvictionRanking(workload.critical),
      enabled: newMode === "enabled",
    };
    const windows = asArray(workload.disruptionWindows);
    if (windows.length > 0) {
      overrides.disruption_windows = windows.map((w) => ({
        start_cron: w.startCron,
        end_cron: w.endCron,
      }));
    }
    updateOverrideMutation.mutate({
      workloadId: workloadIdForApi(workload.id),
      overrides,
    });
  };

  const handleSaveCruiseConfig = () => {
    if (!editWorkload) return;
    const id = workloadIdForApi(editWorkload.id);
    const overrides: Overrides = {
      eviction_ranking: mapCriticalToEvictionRanking(editCritical),
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
    if (valueToParse.endsWith("MB")) {
      return parseFloat(valueToParse.replace("MB", "")) || 0;
    }
    if (valueToParse.endsWith("GB")) {
      return (parseFloat(valueToParse.replace(" GB", "")) || 0) * 1000;
    }
    return parseFloat(valueToParse) || 0;
  };

  /** CPU for table cell: number only (cores), unit is in column header. Shows — when 0. */
  const tableCpuDisplay = (cpuString: string): string => {
    const cores = parseCpuValue(cpuString);
    if (cores === 0) return "—";
    return cores < 1 ? cores.toFixed(4) : cores.toFixed(2);
  };
  /** Memory for table cell: number only (GB), unit is in column header. Shows — when 0. */
  const tableMemDisplay = (memString: string): string => {
    const mb = parseMemoryValue(memString);
    if (mb === 0) return "—";
    return (mb / 1000).toFixed(4);
  };

  const updatedAtSeconds = (w: FrontendWorkload): number => w.updatedAt ?? 0;

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
        case "critical":
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
          const criticalOrder = (p: string) => ({ "very-high": 3, high: 2, medium: 1, low: 0 }[p] ?? -1);
          const aMode = modeOrder(a.mode);
          const bMode = modeOrder(b.mode);
          if (aMode !== bMode) return sortDirection === "asc" ? aMode - bMode : bMode - aMode;
          const aPri = criticalOrder(a.critical);
          const bPri = criticalOrder(b.critical);
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
          aValue = updatedAtSeconds(a);
          bValue = updatedAtSeconds(b);
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
    const matchesCritical = criticalFilter === "all" || w.critical === criticalFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "excluded" && w.excluded === true) ||
      (statusFilter === "blocking-consolidation" && w.blockingConsolidation === true) ||
      (statusFilter === "gpu" && w.isGpuWorkload === true) ||
      (statusFilter === "hpa-enabled" && w.hpaEnabled === true) ||
      (statusFilter === "scaled-down" && w.scaledDown === true);
    const matchesType = typeFilter === "all" || w.type === typeFilter;
    const matchesRecommendations = hasRecommendations === "all" || 
      (hasRecommendations === "yes" && w.hasRecommendations) ||
      (hasRecommendations === "no" && !w.hasRecommendations);
    return matchesSearch && matchesNamespace && matchesMode && matchesCritical && matchesStatus && matchesType && matchesRecommendations;
  });

  const sortedWorkloads = sortWorkloads(filteredWorkloads);
  const selectableWorkloads = asArray(sortedWorkloads).filter((w) => !isWorkloadDisabled(w));

  const toggleSelection = (workloadId: string) => {
    setSelectedWorkloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(workloadId)) next.delete(workloadId);
      else next.add(workloadId);
      return next;
    });
  };
  const selectAllSelectable = () => {
    setSelectedWorkloadIds(new Set(selectableWorkloads.map((w) => w.id)));
  };
  const clearSelection = () => setSelectedWorkloadIds(new Set());
  const allSelectableSelected = selectableWorkloads.length > 0 && selectableWorkloads.every((w) => selectedWorkloadIds.has(w.id));
  const someSelected = selectedWorkloadIds.size > 0;

  const handleBatchEnable = () => {
    const ids = [...selectedWorkloadIds].map((id) => workloadIdForApi(id));
    if (ids.length === 0) return;
    batchOverridesMutation.mutate({ workloadIds: ids, enabled: true });
  };
  const handleBatchDisable = () => {
    const ids = [...selectedWorkloadIds].map((id) => workloadIdForApi(id));
    if (ids.length === 0) return;
    batchOverridesMutation.mutate({ workloadIds: ids, enabled: false });
  };

  const namespaces = [...new Set(asArray(workloads).map((w) => w.namespace))];
  const workloadTypesInData = [...new Set(asArray(workloads).map((w) => w.type))].sort();

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
  const apiErrorMessage = summaryError instanceof Error ? summaryError.message : (summaryError ? "Unknown error" : null);

  const costOptimizedWorkloads = (summaryData?.workloadDetails ?? []).filter((w) => w.config.cruiseEnabled && w.dollarSavingsPerMonth > 0).length;
  const costOptimizedWorkloadsRecommendOnly = (summaryData?.workloadDetails ?? []).filter((w) => !w.config.cruiseEnabled && w.dollarSavingsPerMonth > 0).length;
  const reliabilityIssues = (summaryData?.workloadDetails ?? []).filter((w) => w.dollarExpenditurePerMonth > 0).length;
  const overviewMetrics = {
    costOptimizedWorkloads,
    costOptimizedWorkloadsRecommendOnly,
    reliabilityIssues,
  };

  const hasNoData = !isLoadingMetrics && (summaryData?.workloadDetails?.length ?? 0) === 0;

  const clusterUtilisationTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Cluster utilisation</p>
      <p className="text-xs text-muted-foreground">
        These bars compare allocatable capacity against what workloads are using and what they have requested.
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Utilised: resources currently consumed by running workloads.</li>
        <li>Requested: resources reserved by Kubernetes requests, including unused headroom.</li>
        <li>Free: allocatable capacity not currently requested.</li>
      </ul>
    </div>
  );

  const cruiseKubeAdoptionTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">CruiseKube adoption</p>
      <p className="text-xs text-muted-foreground">
        This summary shows how workloads are distributed across optimization states.
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Total: all workloads discovered in the cluster.</li>
        <li>Skipped: workloads without actionable optimization or excluded from optimization.</li>
        <li>Optimized/Cruise: workloads in Cruise mode, with realized monthly savings.</li>
        <li>Recommended: workloads in Recommend mode, with unrealized monthly savings.</li>
        <li>Reliability Improved: workloads that need more resources, with added monthly cost.</li>
      </ul>
    </div>
  );

  const untappedSavingsTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Untapped savings</p>
      <p className="text-xs text-muted-foreground">
        Possible savings is the monthly reduction available if recommended requests are applied. Current savings is what the cluster is already saving relative to normalized workload requests.
      </p>
    </div>
  );

  const podsTooltipContent = (
    <p className="max-w-xs text-xs text-muted-foreground">
      Number of running pod replicas for this workload.
    </p>
  );

  const netSavingsTooltipContent = (
    <p className="max-w-xs text-xs text-muted-foreground">
      Estimated monthly savings from rightsizing this workload. It reflects only cost reductions from lower resource requests and does not subtract reliability increase costs.
    </p>
  );

  const modeTooltipContent = (
    <p className="max-w-xs text-xs text-muted-foreground">
      Cruise automatically applies recommendations. Recommend shows recommendations without auto-applying them.
    </p>
  );

  const criticalityTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Criticality</p>
      <p className="text-xs text-muted-foreground">
        Indicates how sensitive a workload is during optimization. Higher criticality workloads are treated more conservatively.
      </p>
    </div>
  );

  const modeHeaderTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Mode</p>
      <p className="text-xs text-muted-foreground">
        When on, recommendations are auto-applied in Cruise mode. When off, recommendations are shown without being auto-applied.
      </p>
    </div>
  );

  const resourceHeaderTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">CPU and memory fields</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Current: the workload&apos;s current configured resource request.</li>
        <li>Recommended: the request CruiseKube recommends based on observed usage.</li>
        <li>Savings: the reduction from current request to recommended request.</li>
      </ul>
    </div>
  );

  return (
    <div className="min-w-0 w-full max-w-full animate-fade-in">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {/* Error banner when API fails */}
        {apiErrorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error loading workloads</AlertTitle>
            <AlertDescription>{apiErrorMessage}</AlertDescription>
          </Alert>
        )}
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

        {/* Workload list */}
        <section aria-labelledby="workloads-heading">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <h2 id="workloads-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Workload list
                {sortedWorkloads.length > 0 && (
                  <span className="ml-2 font-normal normal-case text-foreground">({sortedWorkloads.length})</span>
                )}
              </h2>
              <InfoTooltip label="What CruiseKube adoption means" contentClassName="max-w-sm p-4 text-left">
                {cruiseKubeAdoptionTooltipContent}
              </InfoTooltip>
            </div>
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
                <SelectTrigger className="h-9 min-w-[180px] flex-1 max-w-[280px] bg-muted/30 border-border rounded-md text-sm">
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
              <Select value={criticalFilter} onValueChange={setCriticalFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-muted/30 border-border rounded-md text-sm">
                  <SelectValue placeholder="Critical" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Criticalities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="very-high">Very High</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="h-9 w-[200px] bg-muted/30 border-border rounded-md text-sm">
                  <SelectValue placeholder="Excluded / PDB / Blocking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workloads</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                  <SelectItem value="blocking-consolidation">Blocking consolidation</SelectItem>
                  <SelectItem value="gpu">GPU workload</SelectItem>
                  <SelectItem value="hpa-enabled">HPA enabled</SelectItem>
                  <SelectItem value="scaled-down">Scaled down</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[140px] bg-muted/30 border-border rounded-md text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {workloadTypesInData.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
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
                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">Workloads</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">{sortedWorkloads.length}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">Optimized/Cruise</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">{overviewMetrics.costOptimizedWorkloads}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">Recommended</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">{overviewMetrics.costOptimizedWorkloadsRecommendOnly}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">Reliability Improved</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">{overviewMetrics.reliabilityIssues}</span>
                    </div>
                  </div>
                  {someSelected && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {selectedWorkloadIds.size} selected
                      </span>
                      {selectableWorkloads.length > 0 && !allSelectableSelected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={selectAllSelectable}
                        >
                          Select all
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={clearSelection}
                      >
                        Clear selection
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={handleBatchEnable}
                        disabled={batchOverridesMutation.isPending}
                      >
                        {batchOverridesMutation.isPending ? (
                          <>Updating…</>
                        ) : (
                          <>
                            <Zap className="h-3 w-3" />
                            Enable Cruise
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={handleBatchDisable}
                        disabled={batchOverridesMutation.isPending}
                      >
                        Disable Cruise
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              ref={tableScrollRef}
              className="w-full min-w-0 overflow-x-auto"
            >
              {isLoadingSummary ? (
                <div className="flex flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <p className="text-sm font-medium">Loading workloads...</p>
                  <div className="flex gap-1">
                    <Skeleton className="h-2 w-2 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                    <Skeleton className="h-2 w-2 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                    <Skeleton className="h-2 w-2 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              ) : (
              <table className="data-table data-table-compact w-full min-w-full border-collapse" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              {columnWidths.map((w, i) => (
                <col key={i} style={{ width: `${(w / columnWidths.reduce((a, b) => a + b, 0)) * 100}%`, minWidth: MIN_COLUMN_WIDTH }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border">
              <tr>
                <th rowSpan={2} className="w-11 px-2 py-2 align-middle border-r border-border text-center leading-none">
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {selectableWorkloads.length > 0 ? (
                      <Checkbox
                        checked={allSelectableSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => {
                          if (checked === true) selectAllSelectable();
                          else clearSelection();
                        }}
                        aria-label="Select all selectable workloads"
                        className="h-4 w-4 data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground data-[state=indeterminate]:bg-muted data-[state=indeterminate]:text-muted-foreground border-muted-foreground/40"
                      />
                    ) : (
                      <span className="w-4 h-4" aria-hidden />
                    )}
                  </div>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-middle text-center leading-none py-2 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("lastUpdated"); }}
                >
                  <div className="flex items-center justify-center gap-1 pr-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center gap-1 cursor-pointer">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            {sortColumn === "lastUpdated" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Updated at</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(1, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-middle text-left leading-none py-2 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("workload"); }}
                >
                  <div className="flex items-center justify-start gap-1 pr-2">
                    Workload
                    {sortColumn === "workload" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(2, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-middle text-left leading-none py-2 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("namespace"); }}
                >
                  <div className="flex items-center justify-start gap-1 pr-2">
                    Namespace
                    {sortColumn === "namespace" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(3, e.clientX); }} aria-hidden />
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-middle text-center leading-none py-2 relative w-20"
                  onClick={(e) => { e.stopPropagation(); handleSort("replicas"); }}
                >
                  <div className="flex items-center justify-center gap-1 pr-2">
                    Pods
                    <InfoTooltip label="What pod count means">
                      {podsTooltipContent}
                    </InfoTooltip>
                    {sortColumn === "replicas" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(4, e.clientX); }} aria-hidden />
                </th>
                <th colSpan={2} className="border-t border-l border-r border-b-0 border-border bg-muted/40 font-medium align-middle text-center leading-none py-2 px-0">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5">
                      <Cpu className="h-4 w-4" />
                      CPU
                      <InfoTooltip label="How CPU columns are defined" contentClassName="max-w-sm p-4 text-left">
                        {resourceHeaderTooltipContent}
                      </InfoTooltip>
                    </span>
                  </div>
                </th>
                <th colSpan={2} className="border-t border-l border-r border-b-0 border-border bg-muted/40 font-medium align-middle text-center leading-none py-2 px-0">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5">
                      <HardDrive className="h-4 w-4" />
                      Memory
                      <InfoTooltip label="How memory columns are defined" contentClassName="max-w-sm p-4 text-left">
                        {resourceHeaderTooltipContent}
                      </InfoTooltip>
                    </span>
                  </div>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-middle text-center leading-none py-2 relative"
                  onClick={(e) => { e.stopPropagation(); handleSort("netSavings"); }}
                >
                  <div className="flex items-center justify-center gap-1 pr-2">
                    Net Savings/M
                    {sortColumn === "netSavings" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    <InfoTooltip label="What net savings per month means">
                      {netSavingsTooltipContent}
                    </InfoTooltip>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(9, e.clientX); }} aria-hidden />
                </th>
                <th colSpan={2} className="border-t border-l border-r border-b-0 border-border font-medium align-middle text-center leading-none py-2 px-0">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5">
                      Config
                      {sortColumn === "cruiseConfig" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </span>
                  </div>
                </th>
                <th rowSpan={2} className="relative text-center align-middle leading-none py-2">
                  <div className="flex items-center justify-center">
                    Actions
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(12, e.clientX); }} aria-hidden />
                </th>
              </tr>
              <tr>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-l border-border bg-muted/30 relative text-right align-middle leading-none py-1.5"
                  onClick={(e) => { e.stopPropagation(); handleSort("currentCpu"); }}
                >
                  <div className="flex items-center justify-end gap-1 pr-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <span className="cursor-help">Curr.</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Current</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {sortColumn === "currentCpu" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(5, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-r border-border bg-muted/30 relative text-right align-middle leading-none py-1.5"
                  onClick={(e) => { e.stopPropagation(); handleSort("recommendedCpu"); }}
                >
                  <div className="flex items-center justify-end gap-1 pr-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <span className="cursor-help">Rec.</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Recommended</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {sortColumn === "recommendedCpu" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(6, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-l border-border bg-muted/30 relative text-right align-middle leading-none py-1.5"
                  onClick={(e) => { e.stopPropagation(); handleSort("currentMem"); }}
                >
                  <div className="flex items-center justify-end gap-1 pr-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <span className="cursor-help">Curr.</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Current</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {sortColumn === "currentMem" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(7, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-r border-border bg-muted/30 relative text-right align-middle leading-none py-1.5"
                  onClick={(e) => { e.stopPropagation(); handleSort("recommendedMem"); }}
                >
                  <div className="flex items-center justify-end gap-1 pr-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <span className="cursor-help">Rec.</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Recommended</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {sortColumn === "recommendedMem" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(8, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-l border-border relative text-center align-middle leading-none py-1.5"
                  onClick={(e) => { e.stopPropagation(); handleSort("cruiseConfig"); }}
                >
                  <div className="flex items-center justify-center gap-1 pr-2">
                    Mode
                    <InfoTooltip label="How mode is defined" contentClassName="max-w-sm p-4 text-left">
                      {modeHeaderTooltipContent}
                    </InfoTooltip>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(10, e.clientX); }} aria-hidden />
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-r border-border relative text-center align-middle leading-none py-1.5"
                  onClick={(e) => { e.stopPropagation(); handleSort("cruiseConfig"); }}
                >
                  <div className="flex items-center justify-center gap-1 pr-2">
                    Critical
                    <InfoTooltip label="How criticality is defined" contentClassName="max-w-sm p-4 text-left">
                      {criticalityTooltipContent}
                    </InfoTooltip>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(11, e.clientX); }} aria-hidden />
                </th>
              </tr>
            </thead>
            <tbody>
              {asArray(sortedWorkloads).map((workload, index) => (
                <tr
                  key={workload.id}
                  className={`group transition-colors ${
                    isWorkloadDisabled(workload)
                      ? "opacity-60 bg-muted/40 border-l-2 border-l-muted-foreground/40 hover:bg-muted/50"
                      : "hover:bg-muted/50 " + (index % 2 === 1 ? "bg-muted/10" : "")
                  }`}
                >
                  <td className="w-11 px-2 align-middle border-r border-border text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center min-h-[2rem]">
                      <Checkbox
                        checked={selectedWorkloadIds.has(workload.id)}
                        onCheckedChange={() => !isWorkloadDisabled(workload) && toggleSelection(workload.id)}
                        disabled={isWorkloadDisabled(workload)}
                        aria-label={`Select ${workload.workload}`}
                        className="h-4 w-4 data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground border-muted-foreground/40"
                      />
                    </div>
                  </td>
                  <td className="border-l border-b border-border min-w-0 overflow-hidden align-middle text-center text-xs text-muted-foreground whitespace-nowrap">
                    {workload.updatedAt != null ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">{workload.lastUpdated}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {formatUpdatedAtFull(workload.updatedAt)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      workload.lastUpdated
                    )}
                  </td>
                  <td className="min-w-0 break-words align-middle text-left">
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-start min-w-0">
                      <span className="shrink-0 inline-flex items-center gap-1 self-start mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <WorkloadTypeIcon type={workload.type} />
                        <WorkloadStatusIcons workload={workload} />
                      </span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className={`font-medium break-words min-w-0 ${isWorkloadDisabled(workload) ? "text-muted-foreground" : ""}`}>{workload.workload}</span>
                        {(workload.excluded || (workload.excludedCodes && workload.excludedCodes.length > 0)) && (
                          <div className="flex flex-wrap gap-1">
                            {workload.excluded && (
                              <Badge variant="secondary" className="text-xs font-normal py-0">
                                {workload.excludedReason || "Excluded from optimization"}
                              </Badge>
                            )}
                            {workload.excludedCodes?.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs font-normal py-0 text-muted-foreground border-muted-foreground/30">
                                {EXCLUDED_CODE_LABELS[code] ?? code}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs min-w-0 break-words align-middle text-left">{workload.namespace}</td>
                  <td className="font-mono text-sm tabular-nums text-right min-w-0 align-middle">{workload.replicas}</td>
                  <td className={`font-mono text-sm tabular-nums text-right bg-muted/20 border-l border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.currentCpu}
                  </td>
                  <td className={`font-mono text-sm tabular-nums text-right bg-muted/20 border-r border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.recommendedCpu}
                    {workload.potentialCpu !== 0 && (
                      <span className={workload.potentialCpu > 0 ? "text-amber-500 dark:text-amber-400" : ""}>
                        <br /><span className="opacity-40">({formatCpuSigned(workload.potentialCpu)})</span>
                      </span>
                    )}
                  </td>
                  <td className={`font-mono text-sm tabular-nums text-right bg-muted/20 border-l border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.currentMem}
                  </td>
                  <td className={`font-mono text-sm tabular-nums text-right bg-muted/20 border-r border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.recommendedMem}
                    {workload.potentialMem !== 0 && (
                      <span className={workload.potentialMem > 0 ? "text-amber-500 dark:text-amber-400 opacity-100" : ""}>
                        <br /><span className="opacity-40">({formatMemorySigned(workload.potentialMem)})</span>
                      </span>
                    )}
                  </td>
                  <td className="font-mono text-sm text-right min-w-0 align-middle overflow-hidden">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex flex-col items-end gap-0.5 cursor-default min-w-0">
                            {(() => {
                              const net = workload.potentialDollars - workload.reliabilityCostDollars;
                              const hasReliability = workload.reliabilityCostDollars > 0;
                              const display = net === 0 ? "—" : (net >= 0 ? `$${net.toFixed(2)}` : `-$${Math.abs(net).toFixed(2)}`);
                              return (
                                <>
                                  <span className={net > 0 ? "text-primary" : net < 0 ? "text-destructive" : "text-muted-foreground"}>{display}</span>
                                  {hasReliability && (
                                    <span className="inline-flex items-center gap-0.5 text-success text-xs font-medium" aria-label="Reliability improved" title="Reliability improved (resources recommended to be increased)">
                                      <span className="whitespace-nowrap">Reliability</span>
                                      <FontAwesomeIcon icon={faCircleArrowUp} className="h-3.5 w-3.5 shrink-0" />
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>Net = Possible savings − cost of reliability increases. {workload.reliabilityCostDollars > 0 ? "Reliability Up: this workload had reliability improved (resources recommended to be increased)." : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className={`min-w-0 overflow-hidden ${index === 0 ? "border-t" : ""} border-l border-b border-border align-middle`}>
                    <div className="flex justify-center min-w-0" onClick={(e) => e.stopPropagation()}>
                      {isWorkloadDisabled(workload) ? (
                        <span className="text-xs font-medium text-muted-foreground">Excluded</span>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1.5 cursor-default">
                                <Switch
                                  checked={workload.mode === "enabled"}
                                  onCheckedChange={() => handleModeToggle(workload)}
                                  disabled={updateOverrideMutation.isPending}
                                  className="scale-90 opacity-90 data-[state=checked]:bg-muted-foreground/80"
                                  aria-label={workload.mode === "enabled" ? "Cruise on; click to switch to Recommend" : "Recommend; click to switch to Cruise"}
                                />
                                <span className={`text-xs ${workload.mode === "enabled" ? "text-success" : "text-muted-foreground"}`}>
                                  {workload.mode === "enabled" ? "On" : "Off"}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>When on, recommendations are auto-applied (Cruise). When off, recommend only. Click to toggle.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </td>
                  <td className={`border-r border-b border-border min-w-0 overflow-hidden ${index === 0 ? "border-t" : ""} align-middle`}>
                    <div className="flex flex-col gap-0.5 justify-center min-w-0">
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <span className={`text-xs font-medium capitalize ${getCriticalColor(isWorkloadDisabled(workload) ? "excluded" : workload.critical)}`}>
                          {isWorkloadDisabled(workload) ? "Excluded" : workload.critical}
                        </span>
                        {!isWorkloadDisabled(workload) && asArray(workload.disruptionWindows).length > 0 && (
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
                  <td className="min-w-0 overflow-hidden align-middle whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1 min-w-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => navigate(`/workloads/${workload.namespace}/${workload.workload}`)}
                              disabled={isWorkloadDisabled(workload)}
                              aria-label={`Pod details for ${workload.workload}`}
                            >
                              <List className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Pod Details</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => navigate(`/events?workload=${encodeURIComponent(workloadIdForApi(workload.id))}`)}
                              disabled={isWorkloadDisabled(workload)}
                              aria-label={`View events for ${workload.workload}`}
                            >
                              <Activity className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View events for this workload</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => openEditModal(workload)}
                              disabled={isWorkloadDisabled(workload)}
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
              )}
        </div>
      </div>

      {!isLoadingSummary && sortedWorkloads.length === 0 && (
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
                  <>Update critical, mode, and disruption windows for <span className="font-medium text-foreground">{editWorkload.workload}</span> in <span className="font-mono text-foreground">{editWorkload.namespace}</span>.</>
                )}
              </DialogDescription>
            </DialogHeader>
            {editWorkload && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">CruiseOn</label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editMode === "enabled"}
                      onCheckedChange={(checked) => setEditMode(checked ? "enabled" : "recommend-only")}
                      disabled={updateOverrideMutation.isPending}
                      aria-label="CruiseOn"
                    />
                    <span className="text-sm text-muted-foreground">
                      {editMode === "enabled"
                        ? "Recommendations will be applied to pods."
                        : "Recommendations are only computed — not shown to pods."}
                    </span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Critical</label>
                  <Select value={editCritical} onValueChange={(v) => setEditCritical(v as typeof editCritical)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="very-high">very-high</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    During node consolidation, the controller may need to evict pods to free capacity. Higher critical workloads are evicted last; low critical first. Use <strong>very-high</strong> for workloads that must never be evicted (e.g. critical system pods). Use <strong>High</strong> for important apps and <strong>Low</strong> for best-effort or batch workloads.
                  </p>
                </div>
                {editWorkload.blockingConsolidation && (
                  <Alert className="border-amber-500/50 bg-amber-500/10 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Disruption window recommended</AlertTitle>
                    <AlertDescription>
                      This workload will block node consolidation because of{" "}
                      {[editWorkload.blockingConsolidationPdb && "Pod Disruption Budget (PDB)", editWorkload.blockingConsolidationDoNotDisrupt && "do-not-disrupt annotation"]
                        .filter(Boolean)
                        .join(" and ")}
                      . Set up a disruption window below so that during the window, pod disruption budgets and do-not-disrupt annotations are temporarily removed from this workload, allowing nodes to consolidate. Constraints are applied back automatically just before the disruption window ends.
                    </AlertDescription>
                  </Alert>
                )}
                <DisruptionWindowEditor
                  windows={editDisruptionWindows}
                  onChange={setEditDisruptionWindows}
                  disabled={updateOverrideMutation.isPending}
                  allowAdd={editWorkload.blockingConsolidation}
                />
                {!editWorkload.blockingConsolidation && (
                  <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2">
                    This workload doesn&apos;t have pod-disruption-budgets or do-not-disrupt marked. No disruption window needs to be provided in this case since it will not block node consolidation.
                  </p>
                )}
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

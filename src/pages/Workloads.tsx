import { useState } from "react";
import { 
  Search, 
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Layers,
  Clock,
  DollarSign,
  AlertTriangle,
  TrendingDown,
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient } from "@/lib/api";
import { 
  transformStatsToWorkloads, 
  FrontendWorkload,
  transformStatsToOverviewMetrics,
  OverviewMetrics,
  calculateDollarSavings
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { asArray } from "@/lib/utils";

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

export default function Workloads() {
  const navigate = useNavigate();
  const { selectedClusterId } = useCluster();
  const [search, setSearch] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [hasRecommendations, setHasRecommendations] = useState("all");
  const [sortColumn, setSortColumn] = useState<string | null>("potentialDollars");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>("desc");
  const [verbose, setVerbose] = useState(false);

  const { data: statsData, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['cluster-stats', selectedClusterId],
    queryFn: () => apiClient.getClusterStats(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const { data: workloadsData, isLoading: isLoadingWorkloads, error: workloadsError } = useQuery({
    queryKey: ['workloads', selectedClusterId],
    queryFn: () => apiClient.getWorkloads(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const { data: recommendationAnalysis, isLoading: isLoadingRecommendationAnalysis } = useQuery({
    queryKey: ['recommendation-analysis', selectedClusterId],
    queryFn: () => apiClient.getRecommendationAnalysis(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const prometheusQueries = {
    cpuUtilised: `round(
      sum(
        sum by (node) (
          rate(node_cpu_seconds_total{job="node-exporter", mode=~"user|system"}[1m])
        )
        unless max by (node) (
          max_over_time(kube_node_status_allocatable{
            job="kube-state-metrics",
            resource=~"nvidia_com_gpu|amd_com_gpu"
          }[7d:]) > 0
        )
      ),
      0.001
    )`,
    cpuRequested: `round(
      sum(
        sum by (node) (
          (
            (
              sum by (namespace, pod) (kube_pod_container_resource_requests{job="kube-state-metrics", container!="", resource="cpu"})
            )
            unless on (namespace, pod)
            (
              sum by (namespace, pod) (kube_pod_container_resource_requests{job="kube-state-metrics", container!="", resource=~"nvidia_com_gpu|amd_com_gpu"})
            )
          )
          * on (namespace, pod) group_left
            sum by (namespace, pod) (kube_pod_status_phase{job="kube-state-metrics", phase!~"Failed|Succeeded|Unknown|Pending"})
        )
        unless on (node)
        (
          max by (node) (
            max_over_time(
              kube_node_status_allocatable{job="kube-state-metrics", resource=~"nvidia_com_gpu|amd_com_gpu"}[7d:]
            )
          )
          >
          0
        )
      ),
      0.001
    )`,
    cpuAllocatable: `round(
      sum(
        sum by (node) (kube_node_status_allocatable{job="kube-state-metrics", resource="cpu"})
        unless (
          sum by (node) (
            kube_node_spec_taint{job="kube-state-metrics", key="nvidia.com/gpu"}
          )
        )
        unless on (node) (
          kube_node_labels{job="kube-state-metrics", accelerator="nvidia"}
        )
      ),
      0.001
    )`,
    memoryUtilised: `round(
      sum(
        sum by (node) (
          node_memory_MemTotal_bytes{job="node-exporter"} - (node_memory_MemFree_bytes{job="node-exporter"} + node_memory_Buffers_bytes{job="node-exporter"} + node_memory_Cached_bytes{job="node-exporter"})
        )
        unless
        max by (node) (
          max_over_time(kube_node_status_allocatable{job="kube-state-metrics", resource=~"nvidia_com_gpu|amd_com_gpu"}[7d:])
        ) > 0
      )
      / 1000000000,
      0.001
    )`,
    memoryRequested: `round(
      sum(
        sum by (node) (
          (
            (
              sum by (namespace, pod) (kube_pod_container_resource_requests{job="kube-state-metrics", container!="", resource="memory"})
            )
            unless on (namespace, pod)
            (
              sum by (namespace, pod) (kube_pod_container_resource_requests{job="kube-state-metrics", container!="", resource=~"nvidia_com_gpu|amd_com_gpu"})
            )
          )
          * on (namespace, pod) group_left
            sum by (namespace, pod) (kube_pod_status_phase{job="kube-state-metrics", phase!~"Failed|Succeeded|Unknown|Pending"})
        )
        unless on (node)
        (
          max by (node) (
            max_over_time(
              kube_node_status_allocatable{job="kube-state-metrics", resource=~"nvidia_com_gpu|amd_com_gpu"}[7d:]
            )
          )
          >
          0
        )
      ) / 1000000000,
      0.001
    )`,
    memoryAllocatable: `round(
      sum(
        sum by (node) (kube_node_status_allocatable{job="kube-state-metrics", resource="memory"})
        unless (
          sum by (node) (kube_node_spec_taint{job="kube-state-metrics", key="nvidia.com/gpu"})
        )
        unless on (node) (
          kube_node_labels{job="kube-state-metrics", accelerator="nvidia"}
        )
      ) / 1000000000,
      0.001
    )`,
  };

  const { data: clusterMetrics, isLoading: isLoadingClusterMetrics } = useQuery({
    queryKey: ['cluster-metrics', selectedClusterId],
    queryFn: async () => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      const results = await Promise.all([
        apiClient.queryPrometheus(selectedClusterId, prometheusQueries.cpuUtilised).catch(() => null),
        apiClient.queryPrometheus(selectedClusterId, prometheusQueries.cpuRequested).catch(() => null),
        apiClient.queryPrometheus(selectedClusterId, prometheusQueries.cpuAllocatable).catch(() => null),
        apiClient.queryPrometheus(selectedClusterId, prometheusQueries.memoryUtilised).catch(() => null),
        apiClient.queryPrometheus(selectedClusterId, prometheusQueries.memoryRequested).catch(() => null),
        apiClient.queryPrometheus(selectedClusterId, prometheusQueries.memoryAllocatable).catch(() => null),
      ]);
      return {
        cpuUtilised: results[0]?.data?.result?.[0]?.value?.[1] || null,
        cpuRequested: results[1]?.data?.result?.[0]?.value?.[1] || null,
        cpuAllocatable: results[2]?.data?.result?.[0]?.value?.[1] || null,
        memoryUtilised: results[3]?.data?.result?.[0]?.value?.[1] || null,
        memoryRequested: results[4]?.data?.result?.[0]?.value?.[1] || null,
        memoryAllocatable: results[5]?.data?.result?.[0]?.value?.[1] || null,
      };
    },
    enabled: !!selectedClusterId,
    retry: false,
  });

  let rawWorkloads: FrontendWorkload[] = [];
  try {
    const workloadsList = Array.isArray(workloadsData) ? workloadsData : [];
    const analysisList = Array.isArray(recommendationAnalysis?.analysis) ? recommendationAnalysis?.analysis : undefined;
    rawWorkloads = statsData && workloadsData
      ? transformStatsToWorkloads(statsData, workloadsList, analysisList)
      : [];
  } catch {
    rawWorkloads = [];
  }
  const workloads: FrontendWorkload[] = Array.isArray(rawWorkloads) ? rawWorkloads : [];

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

        case "currentCpu":
        case "recommendedCpu":
        case "potentialCpu":
          aValue = parseCpuValue(a[sortColumn as keyof FrontendWorkload] as string);
          bValue = parseCpuValue(b[sortColumn as keyof FrontendWorkload] as string);
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "currentMem":
        case "recommendedMem":
        case "potentialMem":
          aValue = parseMemoryValue(a[sortColumn as keyof FrontendWorkload] as string);
          bValue = parseMemoryValue(b[sortColumn as keyof FrontendWorkload] as string);
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

  const isLoadingMetrics = isLoadingStats || isLoadingWorkloads || isLoadingRecommendationAnalysis || isLoadingClusterMetrics;

  if (statsError || workloadsError) {
    const errorMessage = statsError instanceof Error ? statsError.message : workloadsError instanceof Error ? workloadsError.message : 'Unknown error';
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

  let overviewMetrics: OverviewMetrics = {
    optimizationScore: 0,
    coverage: 0,
    potentialSavings: { cpu: 0, memory: 0, dollars: 0 },
    realizedSavings: { cpu: 0, memory: 0, dollars: 0 },
    reliabilityIssues: 0,
    reliabilityIncreaseCost: { cpu: 0, memory: 0, dollars: 0 },
    costOptimizedWorkloadsRecommendOnly: 0,
    costOptimizedWorkloads: 0,
    totalSavedPerHour: 0,
    realizedDollars: 0,
    unrealizedDollars: 0,
  };

  if (statsData) {
    const workloadsList = Array.isArray(workloadsData) ? workloadsData : [];
    const analysisList = Array.isArray(recommendationAnalysis?.analysis) ? recommendationAnalysis!.analysis : undefined;
    overviewMetrics = transformStatsToOverviewMetrics(statsData, workloadsList, analysisList);
  }

  /** True when cluster has no stats/workload data to show. */
  const hasNoData = !isLoadingMetrics && (statsData?.stats == null || (Array.isArray(statsData?.stats) && statsData.stats.length === 0));

  /** All cost and projected calculations in one place. */
  const {
    currentCostDollars,
    projectedCostDollars,
    projectedSavingsFromCapacityDollars,
    projectedSavingsPct,
  } = (() => {
    const cpuOptRequested = Number(clusterMetrics?.cpuRequested ?? 0);
    const cpuOptAllocatable = Number(clusterMetrics?.cpuAllocatable ?? 0);
    const memOptRequested = Number(clusterMetrics?.memoryRequested ?? 0);
    const memOptAllocatable = Number(clusterMetrics?.memoryAllocatable ?? 0);

    const cpuUnoptRequested = cpuOptRequested * 2;
    const memUnoptRequested = memOptRequested * 2.5;

    const cpuUnoptAllocatable =
      cpuOptRequested > 0 ? (cpuUnoptRequested * cpuOptAllocatable) / cpuOptRequested : 0;
    const memUnoptAllocatable =
      memOptRequested > 0 ? (memUnoptRequested * memOptAllocatable) / memOptRequested : 0;

    const hasAllocatable =
      clusterMetrics?.cpuAllocatable != null && clusterMetrics?.memoryAllocatable != null;
    const currentCostDollars = hasAllocatable
      ? calculateDollarSavings(cpuOptAllocatable, memOptAllocatable)
      : 0;
    const projectedCostDollars = hasAllocatable
      ? calculateDollarSavings(cpuUnoptAllocatable, memUnoptAllocatable)
      : 0;
    const projectedSavingsFromCapacityDollars = Math.max(0, projectedCostDollars - currentCostDollars);
    const projectedSavingsPct =
      projectedCostDollars > 0
        ? (dollars: number) => ((dollars / projectedCostDollars) * 100).toFixed(1)
        : () => "—";

    const log = {
      "Cluster (optimised)": {
        "CPU requested (cores)": cpuOptRequested,
        "CPU allocatable (cores)": cpuOptAllocatable,
        "Memory requested (GB)": memOptRequested,
        "Memory allocatable (GB)": memOptAllocatable,
      },
      "Unoptimised (ratio-derived)": {
        "CPU requested (2×)": cpuUnoptRequested,
        "Memory requested (2.5×)": memUnoptRequested,
        "CPU allocatable": cpuUnoptAllocatable,
        "Memory allocatable (GB)": memUnoptAllocatable,
      },
      "Cost ($/month)": {
        "Current (allocatable)": currentCostDollars,
        "Projected (unoptimised allocatable)": projectedCostDollars,
        "Possible savings (capacity)": projectedSavingsFromCapacityDollars,
      },
    };
    console.log("[Workloads] Cost & projected calculations", log);

    return {
      currentCostDollars,
      projectedCostDollars,
      projectedSavingsFromCapacityDollars,
      projectedSavingsPct,
    };
  })();

  const pricing = getResourcePricing();
  const costTooltipContent = (
    <div className="space-y-3">
      <p className="font-medium text-foreground">How current cost is calculated</p>
      <p className="text-xs text-muted-foreground">
        Monthly cost = (allocatable CPU cores × ${pricing.cpuPerCorePerHour}/hr + allocatable memory in GB × ${pricing.memoryPerGbPerHour}/hr) × 720 hours per month.
        Uses cluster-wide allocatable resources from Prometheus (not requested or recommendations). Configure prices in Policies &amp; Configuration → Resource Pricing.
      </p>
      <p className="font-medium text-foreground text-xs pt-1 border-t border-border">Assumptions</p>
      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
        <li>If a workload ran in the last 24 hours, we assume it will run continuously for the next 1 month.</li>
        <li>Current workload config is assumed to remain static for the next 1 month.</li>
        <li>Allocatable depends on node provisioning (partially out of scope for CruiseKube); we assume allocatable/requested to remain constant in the optimisation process.</li>
      </ul>
    </div>
  );

  const projectedSavingsTooltipContent = (
    <div className="space-y-3">
      <p className="font-medium text-foreground">Possible Savings</p>
      <p className="text-xs text-muted-foreground">
        Net monthly savings: savings from downsizing overprovisioned workloads that have Cruise mode on, minus the monthly cost to apply reliability (upsize) recommendations. Shown value = Cruise-mode savings − reliability improvement cost.
      </p>
      <p className="font-medium text-foreground text-xs pt-1 border-t border-border">Calculation</p>
      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
        <li>For each overprovisioned workload with Cruise mode on: Δ CPU = current − recommended (cores), Δ memory (GB) = (current − recommended) / 1024.</li>
        <li>Per workload hourly savings = Δ CPU × ${pricing.cpuPerCorePerHour}/hr + Δ memory (GB) × ${pricing.memoryPerGbPerHour}/hr.</li>
        <li>Per workload monthly = hourly × 720 hours. Cruise-mode total = sum over those workloads.</li>
        <li>Possible Savings (shown) = Cruise-mode total − reliability improvement cost ($/month).</li>
      </ol>
      <p className="text-xs text-muted-foreground font-mono pt-1 border-t border-border/50">
        Shown = Σ (Cruise-mode Δ CPU × {pricing.cpuPerCorePerHour} + Δ memory GB × {pricing.memoryPerGbPerHour}) × 720 − reliability cost
      </p>
      <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
        The percentage is relative to projected cost (unoptimised cluster cost from requested/allocated ratio), not current cost.
      </p>
    </div>
  );

  return (
    <div className="min-w-0 w-full max-w-full p-4 space-y-6 animate-fade-in">
      {/* Error / empty data banner */}
      {hasNoData && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
          <Info className="h-4 w-4" />
          <AlertTitle>No workload data available</AlertTitle>
          <AlertDescription>
            No workload or stats data was returned for this cluster. The cluster may have no workloads yet, or the data sync may not have completed. Try refreshing the page or selecting another cluster.
          </AlertDescription>
        </Alert>
      )}
      {/* Header */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-foreground">Workloads & Recommendations</h1>
          <p className="truncate text-sm text-muted-foreground">Container-aware workload list with optimization recommendations</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statsData && (statsData.stats ?? []).length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span>
                Last sync: {(statsData.stats ?? [])[0]?.updated_at 
                  ? new Date((statsData.stats ?? [])[0].updated_at).toLocaleString()
                  : 'Unknown'}
              </span>
            </div>
          )}
          {/* <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{asArray(workloads).length} workloads</span> */}
        </div>
      </div>

      {/* Row: Current cost, Possible Savings, Reliability improvement cost, Workload summary (right) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Current cost — same style as other cost cards (MetricCard layout) */}
        <div className="metric-card border-border">
          {isLoadingClusterMetrics ? (
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
                        {costTooltipContent}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                  ${currentCostDollars.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
                </p>
                <p className="text-sm text-muted-foreground">Based on allocatable CPU + Memory</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>

        {/* Possible Savings — custom layout with centered percentage */}
        {isLoadingMetrics ? (
          <div className="metric-card border-border">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="metric-card border-border flex flex-col">
            <div className="flex items-start justify-between flex-1 min-h-0">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Possible Savings</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none shrink-0" aria-label="Projected Savings calculation">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
                        {projectedSavingsTooltipContent}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                  ${(overviewMetrics.realizedDollars + overviewMetrics.unrealizedDollars).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center w-full mt-1 pt-1 border-t border-border/50">
              {projectedCostDollars > 0 ? (
                <span className="font-medium text-foreground">{projectedSavingsPct(overviewMetrics.realizedDollars + overviewMetrics.unrealizedDollars)}% of projected cost</span>
              ) : (
                "Per month savings"
              )}
            </p>
            <p className="text-xs text-muted-foreground text-center w-full mt-0.5">
              Percentage based on projected cost (unoptimised allocated from requested/allocated ratio).
              Projected cost = ${projectedCostDollars.toLocaleString()}
            </p>
          </div>
        )}

        {/* Reliability improvement cost — own box */}
        {isLoadingMetrics ? (
          <div className="metric-card border-border">
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-8 w-20" />
          </div>
        ) : (
          <div className="metric-card border-border">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reliability improvement cost</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>Underprovisioned workloads: extra monthly cost to apply recommendations (add CPU/memory).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                  ${overviewMetrics.reliabilityIncreaseCost.dollars.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
                </p>
                <p className="text-sm text-muted-foreground">{overviewMetrics.reliabilityIssues} workload{overviewMetrics.reliabilityIssues !== 1 ? "s" : ""} underprovisioned</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Workload summary — right most */}
        {isLoadingMetrics ? (
          <div className="metric-card border-border">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="metric-card border-border">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Workload summary</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">Total</span>
                <span className="font-mono font-semibold tabular-nums">{asArray(workloads).length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Skipped 
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p>Workloads already at the recommended resource level (no change needed).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-mono tabular-nums">{Math.max(0, asArray(workloads).length - overviewMetrics.costOptimizedWorkloadsRecommendOnly - overviewMetrics.costOptimizedWorkloads)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Optimized 
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p>Overprovisioned workloads with Cruise mode on: optimization applied automatically. Savings per month.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-mono tabular-nums">${overviewMetrics.realizedDollars.toLocaleString()}/mo · {overviewMetrics.costOptimizedWorkloads}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  Recommended 
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p>Overprovisioned workloads in Recommend-only mode. Potential savings if recommendations are applied.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <span className="font-mono tabular-nums">${overviewMetrics.unrealizedDollars.toLocaleString()}/mo · {overviewMetrics.costOptimizedWorkloadsRecommendOnly}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cluster Resource Metrics: CPU & Memory Utilised / Requested / Allocatable */}
      <div className="grid gap-4 md:grid-cols-2">
        {isLoadingClusterMetrics ? (
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
                <span className="font-mono text-sm font-semibold">{formatCpuValue(clusterMetrics?.cpuAllocatable ?? null)} allocatable</span>
              </div>
              {(() => {
                const alloc = Number(clusterMetrics?.cpuAllocatable ?? 0);
                const used = Number(clusterMetrics?.cpuUtilised ?? 0);
                const req = Number(clusterMetrics?.cpuRequested ?? 0);
                const pctUsed = alloc > 0 ? Math.min(100, (used / alloc) * 100) : 0;
                const pctReserved = alloc > 0 ? Math.min(100 - pctUsed, (Math.max(0, req - used) / alloc) * 100) : 0;
                const pctFree = Math.max(0, 100 - pctUsed - pctReserved);
                return (
                  <>
                    <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted/60">
                      {pctUsed > 0 && <div className="h-full bg-primary transition-all" style={{ width: `${pctUsed}%` }} title={`Utilised: ${formatCpuValue(clusterMetrics?.cpuUtilised ?? null)}`} />}
                      {pctReserved > 0 && <div className="h-full bg-primary/50 transition-all" style={{ width: `${pctReserved}%` }} title={`Requested (unused): ${(req - used).toFixed(2)} cores`} />}
                      {pctFree > 0 && <div className="h-full flex-1 bg-transparent" style={{ width: `${pctFree}%` }} title="Free" />}
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>Utilised <span className="text-foreground">{formatCpuValue(clusterMetrics?.cpuUtilised ?? null)}</span></span>
                    <span>Requested <span className="text-foreground">{formatCpuValue(clusterMetrics?.cpuRequested ?? null)}</span></span>
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
                <span className="font-mono text-sm font-semibold">{formatMemoryValue(clusterMetrics?.memoryAllocatable ?? null)} allocatable</span>
              </div>
              {(() => {
                const alloc = Number(clusterMetrics?.memoryAllocatable ?? 0);
                const used = Number(clusterMetrics?.memoryUtilised ?? 0);
                const req = Number(clusterMetrics?.memoryRequested ?? 0);
                const pctUsed = alloc > 0 ? Math.min(100, (used / alloc) * 100) : 0;
                const pctReserved = alloc > 0 ? Math.min(100 - pctUsed, (Math.max(0, req - used) / alloc) * 100) : 0;
                const pctFree = Math.max(0, 100 - pctUsed - pctReserved);
                return (
                  <>
                    <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted/60">
                      {pctUsed > 0 && <div className="h-full bg-primary transition-all" style={{ width: `${pctUsed}%` }} title={`Utilised: ${formatMemoryValue(clusterMetrics?.memoryUtilised ?? null)}`} />}
                      {pctReserved > 0 && <div className="h-full bg-primary/50 transition-all" style={{ width: `${pctReserved}%` }} title={`Requested (unused): ${(req - used).toFixed(2)} GB`} />}
                      {pctFree > 0 && <div className="h-full flex-1 bg-transparent" style={{ width: `${pctFree}%` }} title="Free" />}
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>Utilised <span className="text-foreground">{formatMemoryValue(clusterMetrics?.memoryUtilised ?? null)}</span></span>
                      <span>Requested <span className="text-foreground">{formatMemoryValue(clusterMetrics?.memoryRequested ?? null)}</span></span>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workloads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-border"
          />
        </div>

        <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Namespaces</SelectItem>
            {asArray(namespaces).map((ns) => (
              <SelectItem key={ns} value={ns}>{ns}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="enabled">Cruise</SelectItem>
            <SelectItem value="recommend-only">Recommend</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="non-evictable">Non-evictable</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="verbose-columns"
            checked={verbose}
            onCheckedChange={setVerbose}
            onClick={(e) => e.stopPropagation()}
          />
          <Label htmlFor="verbose-columns" className="text-sm cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
            Verbose (show all columns)
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className=" overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table border-collapse">
            <thead>
              <tr>
                {verbose && (
                  <>
                    <th rowSpan={2}
                      className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                      onClick={(e) => { e.stopPropagation(); handleSort("lastUpdated"); }}
                    >
                      <div className="flex items-center gap-1">
                        Updated
                        {sortColumn === "lastUpdated" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th rowSpan={2}
                      className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                      onClick={(e) => { e.stopPropagation(); handleSort("type"); }}
                    >
                      <div className="flex items-center gap-1">
                        Type
                        {sortColumn === "type" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                  </>
                )}
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                  onClick={(e) => { e.stopPropagation(); handleSort("namespace"); }}
                >
                  <div className="flex items-center gap-1">
                    Namespace
                    {sortColumn === "namespace" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                  onClick={(e) => { e.stopPropagation(); handleSort("workload"); }}
                >
                  <div className="flex items-center gap-1">
                    Workload
                    {sortColumn === "workload" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4 w-20"
                  onClick={(e) => { e.stopPropagation(); handleSort("replicas"); }}
                >
                  <div className="flex items-center gap-1">
                    Pods
                    {sortColumn === "replicas" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th colSpan={3} className="border-t border-l border-r border-b-0 border-border bg-muted/40 text-center font-medium align-top pt-3 pb-0 px-0">
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu className="h-4 w-4" />
                    CPU
                  </span>
                </th>
                <th colSpan={3} className="border-t border-l border-r border-b-0 border-border bg-muted/40 text-center font-medium align-top pt-3 pb-0 px-0">
                  <span className="inline-flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4" />
                    Memory
                  </span>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                  onClick={(e) => { e.stopPropagation(); handleSort("potentialDollars"); }}
                >
                  <div className="flex items-center gap-1">
                  Possible Saving/M
                    {sortColumn === "potentialDollars" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>Saving/month doesn&apos;t include the cost of reliability, and contains only the cost saved on reduced resources.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                  onClick={(e) => { e.stopPropagation(); handleSort("reliabilityCostDollars"); }}
                >
                  <div className="flex items-center gap-1">
                    Reliability Cost/M
                    {sortColumn === "reliabilityCostDollars" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>When a resource is underprovisioned we recommend adding more resources to it; this is the cost it will add.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </th>
                <th rowSpan={2}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                  onClick={(e) => { e.stopPropagation(); handleSort("mode"); }}
                >
                  <div className="flex items-center gap-1">
                    Mode
                    {sortColumn === "mode" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Enables auto-apply of recommendations. When Cruise is enabled, CruiseKube will automatically apply resource recommendations.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </th>
                {verbose && (
                  <>
                    <th rowSpan={2}
                      className="cursor-pointer select-none hover:bg-muted/50 transition-colors align-top pt-4"
                      onClick={(e) => { e.stopPropagation(); handleSort("priority"); }}
                    >
                      <div className="flex items-center gap-1">
                        Priority
                        {sortColumn === "priority" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Determines eviction priority during optimization. Higher priority workloads have a lower chance of being evicted when the algorithm needs to optimize resources.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </th>
                  </>
                )}
                <th rowSpan={2}></th>
              </tr>
              <tr>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-l border-border bg-muted/30"
                  onClick={(e) => { e.stopPropagation(); handleSort("currentCpu"); }}
                >
                  <div className="flex items-center gap-1">
                    Current
                    {sortColumn === "currentCpu" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-border bg-muted/30"
                  onClick={(e) => { e.stopPropagation(); handleSort("recommendedCpu"); }}
                >
                  <div className="flex items-center gap-1">
                    Recommended
                    {sortColumn === "recommendedCpu" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-r border-border bg-muted/30"
                  onClick={(e) => { e.stopPropagation(); handleSort("potentialCpu"); }}
                >
                  <div className="flex items-center gap-1">
                    Savings
                    {sortColumn === "potentialCpu" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-l border-border bg-muted/30"
                  onClick={(e) => { e.stopPropagation(); handleSort("currentMem"); }}
                >
                  <div className="flex items-center gap-1">
                    Current
                    {sortColumn === "currentMem" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-border bg-muted/30"
                  onClick={(e) => { e.stopPropagation(); handleSort("recommendedMem"); }}
                >
                  <div className="flex items-center gap-1">
                    Recommended
                    {sortColumn === "recommendedMem" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
                <th
                  className="cursor-pointer select-none hover:bg-muted/30 transition-colors border-b border-r border-border bg-muted/30"
                  onClick={(e) => { e.stopPropagation(); handleSort("potentialMem"); }}
                >
                  <div className="flex items-center gap-1">
                    Savings
                    {sortColumn === "potentialMem" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {asArray(sortedWorkloads).map((workload, index) => (
                <tr 
                  key={workload.id} 
                  className={`group transition-colors ${
                    workload.excluded
                      ? "opacity-60 bg-muted/50 border-l-2 border-l-muted-foreground/40 cursor-not-allowed hover:bg-muted/50"
                      : "cursor-pointer hover:bg-muted/50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!workload.excluded) navigate(`/workloads/${workload.namespace}/${workload.workload}`);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (workload.excluded) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/workloads/${workload.namespace}/${workload.workload}`);
                    }
                  }}
                >
                  {verbose && (
                    <>
                      <td className="text-muted-foreground text-xs">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-default" onClick={(e) => e.stopPropagation()}>
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
                      <td className="text-muted-foreground">
                        <WorkloadTypeIcon type={workload.type} />
                      </td>
                    </>
                  )}
                  <td className="font-mono text-xs">{workload.namespace}</td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${workload.excluded ? "text-muted-foreground" : ""}`}>{workload.workload}</span>
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
                  <td className="font-mono text-sm tabular-nums text-right">{workload.replicas}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-l border-b border-border ${index === 0 ? "border-t" : ""}`}>{workload.currentCpu}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-b border-border ${index === 0 ? "border-t" : ""}`}>{workload.recommendedCpu}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-r border-b border-border ${workload.potentialCpu.startsWith("+") ? "text-amber-600 dark:text-amber-400" : ""} ${index === 0 ? "border-t" : ""}`}>{workload.potentialCpu === "0m" ? "—" : workload.potentialCpu}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-l border-b border-border ${index === 0 ? "border-t" : ""}`}>{workload.currentMem}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-b border-border ${index === 0 ? "border-t" : ""}`}>{workload.recommendedMem}</td>
                  <td className={`font-mono text-sm bg-muted/20 border-r border-b border-border ${workload.potentialMem.startsWith("+") ? "text-amber-600 dark:text-amber-400" : ""} ${index === 0 ? "border-t" : ""}`}>{workload.potentialMem === "0Mi" ? "—" : workload.potentialMem}</td>
                  <td className="font-mono text-sm text-primary">{workload.potentialDollars === 0 ? "—" : `$${workload.potentialDollars.toFixed(2)}`}</td>
                  <td className="font-mono text-sm">{workload.reliabilityCostDollars > 0 ? `$${workload.reliabilityCostDollars.toFixed(2)}` : "—"}</td>
                  <td>
                    <span className={`text-xs font-medium ${
                      workload.mode === "enabled" ? "text-success" : "text-muted-foreground"
                    }`}>
                      {workload.mode === "enabled" ? "Cruise" : "Recommend"}
                    </span>
                  </td>
                  {verbose && (
                    <>
                      <td>
                        <span className={`text-xs font-medium capitalize ${getPriorityColor(workload.priority)}`}>
                          {workload.priority}
                        </span>
                      </td>
                    </>
                  )}
                  <td>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sortedWorkloads.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No workloads match your filters
        </div>
      )}
    </div>
  );
}

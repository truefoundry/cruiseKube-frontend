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
  HardDrive
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient } from "@/lib/api";
import { 
  transformStatsToWorkloads, 
  FrontendWorkload,
  transformStatsToOverviewMetrics,
  OverviewMetrics
} from "@/lib/transformers";
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

export default function Workloads() {
  const navigate = useNavigate();
  const { selectedClusterId } = useCluster();
  const [search, setSearch] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [hasRecommendations, setHasRecommendations] = useState("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

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

  const workloads: FrontendWorkload[] = statsData && workloadsData 
    ? transformStatsToWorkloads(statsData, workloadsData, recommendationAnalysis?.analysis)
    : [];

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
    if (!sortColumn || !sortDirection) {
      return workloads;
    }

    const sorted = [...workloads].sort((a, b) => {
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

        case "potentialDollars":
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

  const filteredWorkloads = workloads.filter((w) => {
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

  const namespaces = [...new Set(workloads.map((w) => w.namespace))];

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
      <div className="p-6">
        <div className="text-center text-destructive">
          Error loading workloads: {errorMessage}
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "text-destructive";
      case "medium": return "text-warning";
      case "high": return "text-success";
      case "non-evictable": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  let overviewMetrics: OverviewMetrics = {
    optimizationScore: 0,
    coverage: 0,
    potentialSavings: { cpu: 0, memory: 0, dollars: 0 },
    realizedSavings: { cpu: 0, memory: 0, dollars: 0 },
    reliabilityIssues: 0,
    costOptimizedWorkloads: 0,
    totalSavedPerHour: 0,
  };

  if (statsData) {
    overviewMetrics = transformStatsToOverviewMetrics(statsData, workloadsData || [], recommendationAnalysis?.analysis);
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Workloads & Recommendations</h1>
          <p className="text-sm text-muted-foreground">Container-aware workload list with optimization recommendations</p>
        </div>
        <div className="flex items-center gap-2">
          {statsData && statsData.stats.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span>
                Last sync: {statsData.stats[0]?.updated_at 
                  ? new Date(statsData.stats[0].updated_at).toLocaleString()
                  : 'Unknown'}
              </span>
            </div>
          )}
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{workloads.length} workloads</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingMetrics ? (
          <>
            <div className="metric-card space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="metric-card space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="metric-card space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          </>
        ) : (
          <>
            <MetricCard
              title="Reliability Improved"
              value={overviewMetrics.reliabilityIssues}
              subtitle="Workloads with improvements applied"
              icon={AlertTriangle}
              variant={overviewMetrics.reliabilityIssues > 10 ? "warning" : "default"}
            />
            <MetricCard
              title="Cost Optimized"
              value={overviewMetrics.costOptimizedWorkloads}
              subtitle="Workloads with savings applied"
              icon={TrendingDown}
              variant="success"
            />
            <MetricCard
              title="Total Saved / Month"
              value={`$${overviewMetrics.totalSavedPerHour.toLocaleString()}`}
              subtitle="Per month savings"
              icon={DollarSign}
              variant="success"
            />
          </>
        )}
      </div>

      {/* Cluster Resource Metrics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {isLoadingClusterMetrics ? (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="metric-card space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </>
        ) : (
          <>
            <MetricCard
              title="CPU Utilised"
              value={formatCpuValue(clusterMetrics?.cpuUtilised || null)}
              subtitle="Current CPU usage"
              icon={Cpu}
              variant="default"
            />
            <MetricCard
              title="CPU Requested"
              value={formatCpuValue(clusterMetrics?.cpuRequested || null)}
              subtitle="Total CPU requests"
              icon={Cpu}
              variant="default"
            />
            <MetricCard
              title="CPU Allocatable"
              value={formatCpuValue(clusterMetrics?.cpuAllocatable || null)}
              subtitle="Total CPU capacity"
              icon={Cpu}
              variant="default"
            />
            <MetricCard
              title="Memory Utilised"
              value={formatMemoryValue(clusterMetrics?.memoryUtilised || null)}
              subtitle="Current memory usage"
              icon={HardDrive}
              variant="default"
            />
            <MetricCard
              title="Memory Requested"
              value={formatMemoryValue(clusterMetrics?.memoryRequested || null)}
              subtitle="Total memory requests"
              icon={HardDrive}
              variant="default"
            />
            <MetricCard
              title="Memory Allocatable"
              value={formatMemoryValue(clusterMetrics?.memoryAllocatable || null)}
              subtitle="Total memory capacity"
              icon={HardDrive}
              variant="default"
            />
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
            {namespaces.map((ns) => (
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
      </div>

      {/* Table */}
      <div className="metric-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("namespace");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Namespace
                    {sortColumn === "namespace" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("workload");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Workload
                    {sortColumn === "workload" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("type");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Type
                    {sortColumn === "type" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("currentCpu");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Current CPU
                    {sortColumn === "currentCpu" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("recommendedCpu");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Recommended CPU
                    {sortColumn === "recommendedCpu" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("potentialCpu");
                  }}
                >
                  <div className="flex items-center gap-1">
                    CPU Savings
                    {sortColumn === "potentialCpu" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("currentMem");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Current Memory
                    {sortColumn === "currentMem" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("recommendedMem");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Recommended Memory
                    {sortColumn === "recommendedMem" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("potentialMem");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Memory Savings
                    {sortColumn === "potentialMem" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("potentialDollars");
                  }}
                >
                  <div className="flex items-center gap-1">
                    $/month
                    {sortColumn === "potentialDollars" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("lastUpdated");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Updated
                    {sortColumn === "lastUpdated" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("mode");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Mode
                    {sortColumn === "mode" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
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
                <th 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSort("priority");
                  }}
                >
                  <div className="flex items-center gap-1">
                    Priority
                    {sortColumn === "priority" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkloads.map((workload) => (
                <tr 
                  key={workload.id} 
                  className="group cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/workloads/${workload.namespace}/${workload.workload}`);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/workloads/${workload.namespace}/${workload.workload}`);
                    }
                  }}
                >
                  <td className="font-mono text-xs">{workload.namespace}</td>
                  <td>
                    <span className="font-medium">{workload.workload}</span>
                  </td>
                  <td className="text-muted-foreground text-xs">{workload.type}</td>
                  <td className="font-mono text-sm">{workload.currentCpu}</td>
                  <td className="font-mono text-sm">{workload.recommendedCpu}</td>
                  <td className="font-mono text-sm">{workload.potentialCpu}</td>
                  <td className="font-mono text-sm">{workload.currentMem}</td>
                  <td className="font-mono text-sm">{workload.recommendedMem}</td>
                  <td className="font-mono text-sm">{workload.potentialMem}</td>
                  <td className="font-mono text-sm text-primary">${workload.potentialDollars.toFixed(2)}</td>
                  <td className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {workload.lastUpdated}
                    </div>
                  </td>
                  <td>
                    <span className={`text-xs font-medium ${
                      workload.mode === "enabled" ? "text-success" : "text-muted-foreground"
                    }`}>
                      {workload.mode === "enabled" ? "Cruise" : "Recommend"}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs font-medium capitalize ${getPriorityColor(workload.priority)}`}>
                      {workload.priority}
                    </span>
                  </td>
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

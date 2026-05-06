import { useMemo, useState } from "react";
import {
  DollarSign,
  TrendingDown,
  Activity,
  Server,
  Zap,
  LayoutList,
  Cpu,
  HardDrive,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  ComposedChart,
} from "recharts";
import { useCluster } from "@/contexts/ClusterContext";
import {
  apiClient,
  type OverviewResponse,
  type OverviewCoveragePair,
  type OverviewAdoptionCoverage,
  type OverviewResourceStats,
  type HistoricalTimelineResponse,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/** Min 1 hour, max 30 days (for timeline range). */
const TIMELINE_MIN_MS = 1 * 60 * 60 * 1000;
const TIMELINE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

type TimeRangePreset = "6h" | "24h" | "7d" | "30d" | "custom";

function presetToMs(preset: TimeRangePreset): number | null {
  switch (preset) {
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

/** Clamp duration to [TIMELINE_MIN_MS, TIMELINE_MAX_MS]. */
function clampDurationMs(ms: number): number {
  return Math.max(TIMELINE_MIN_MS, Math.min(TIMELINE_MAX_MS, ms));
}

const DEFAULT_COVERAGE = { enabled: 0, disabled: 0 };
const DEFAULT_ADOPTION: OverviewAdoptionCoverage = {
  optimizable: 0,
  nonOptimizable: 0,
  optimizableButExcluded: 0,
  total: 0,
};
const DEFAULT_STATS: OverviewResourceStats = {
  allocatable: 0,
  requested: 0,
  workloadRequested: 0,
  usage: 0,
  recommended: 0,
};

function safeNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeCoverage(c: OverviewCoveragePair | undefined): { enabled: number; disabled: number } {
  if (!c || typeof c !== "object") return DEFAULT_COVERAGE;
  const enabled = safeNumber(c.enabled ?? c.enabed);
  const disabled = safeNumber(c.disabled);
  return { enabled, disabled };
}

function safeAdoption(a: OverviewAdoptionCoverage | undefined): OverviewAdoptionCoverage {
  if (!a || typeof a !== "object") return DEFAULT_ADOPTION;
  return {
    optimizable: safeNumber(a.optimizable),
    nonOptimizable: safeNumber(a.nonOptimizable),
    optimizableButExcluded: safeNumber(a.optimizableButExcluded),
    total: safeNumber(a.total),
  };
}

function safeStats(s: OverviewResourceStats | undefined): OverviewResourceStats {
  if (!s || typeof s !== "object") return DEFAULT_STATS;
  return {
    allocatable: safeNumber(s.allocatable),
    requested: safeNumber(s.requested),
    workloadRequested: safeNumber(s.workloadRequested),
    usage: safeNumber(s.usage),
    recommended: safeNumber(s.recommended),
  };
}

/** Normalize overview response and apply defaults for missing/error data. */
function withDefaults(raw: OverviewResponse | null | undefined): {
  currentMonthlyCost: number;
  currentSavings: number;
  possibleSavings: number;
  clusterUtilisation: number;
  nodeCount: number;
  adoption: OverviewAdoptionCoverage;
  cpuCoverage: OverviewCoveragePair;
  memoryCoverage: OverviewCoveragePair;
  cpuStats: OverviewResourceStats;
  memoryStats: OverviewResourceStats;
} {
  const c = raw?.coverage;
  return {
    currentMonthlyCost: safeNumber(raw?.currentMonthlyCost),
    currentSavings: safeNumber(raw?.currentSavings),
    possibleSavings: safeNumber(raw?.possibleSavings),
    clusterUtilisation: safeNumber(raw?.clusterUtilisation),
    nodeCount: safeNumber(raw?.nodeCount),
    adoption: safeAdoption(c?.adoption),
    cpuCoverage: safeCoverage(c?.cpuCoverage),
    memoryCoverage: safeCoverage(c?.memoryCoverage),
    cpuStats: safeStats(raw?.cpuStats),
    memoryStats: safeStats(raw?.memoryStats),
  };
}

function formatCpuValue(value: number): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(value);
  return `${formatted} cores`;
}
function formatMemoryValue(value: number): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(value);
  return `${formatted} GB`;
}

/** Sanitize legend to a valid CSS/object key (no spaces or special chars) so --color-{key} works. */
function sanitizeChartKey(legend: string): string {
  const s = legend.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "series";
  return s || "series";
}

/** Transform historical timeline API response into chart data (one point per timestamp) and chart config. */
function transformHistoricalTimelineResponse(raw: HistoricalTimelineResponse | null | undefined): {
  data: Record<string, unknown>[];
  config: ChartConfig;
} {
  const byTime = new Map<string, Record<string, number>>();
  const legendMeta = new Map<string, { label: string; color: string }>();
  for (const item of raw?.data ?? []) {
    const ts = item.data?.timestamp ?? "";
    const value = item.data?.value ?? 0;
    const legend = item.legend ?? "";
    if (!ts || !legend) continue;
    const key = sanitizeChartKey(legend);
    if (!byTime.has(ts)) byTime.set(ts, {});
    byTime.get(ts)![key] = value;
    if (!legendMeta.has(key)) legendMeta.set(key, { label: legend, color: item.color ?? "#888" });
  }
  const sortedTimes = [...byTime.keys()].sort();
  const data: Record<string, unknown>[] = sortedTimes.map((ts) => {
    const point = byTime.get(ts)!;
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    const timeLabel = `${dateStr} ${timeStr}`;
    return { time: timeLabel, ...point };
  });
  const config: ChartConfig = {};
  for (const [key, { label, color }] of legendMeta) {
    config[key] = { label, color };
  }
  return { data, config };
}

export default function Overview() {
  const navigate = useNavigate();
  const { selectedClusterId } = useCluster();

  const [historicalMetric, setHistoricalMetric] = useState<"cpu" | "memory">("cpu");
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>("6h");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const historicalDateRange = useMemo(() => {
    const now = Date.now();
    let endMs: number;
    let startMs: number;

    if (timeRangePreset === "custom" && customStart && customEnd) {
      const start = new Date(customStart).getTime();
      const end = new Date(customEnd).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const duration = clampDurationMs(end - start);
        endMs = Math.min(end, now);
        startMs = endMs - duration;
      } else {
        const duration = clampDurationMs(7 * 24 * 60 * 60 * 1000);
        endMs = now;
        startMs = endMs - duration;
      }
    } else {
      const presetMs = presetToMs(timeRangePreset);
      const duration = presetMs != null ? clampDurationMs(presetMs) : clampDurationMs(7 * 24 * 60 * 60 * 1000);
      endMs = now;
      startMs = endMs - duration;
    }

    return {
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
    };
  }, [timeRangePreset, customStart, customEnd]);

  const [overviewResult, historicalResult, costHistoricalResult] = useQueries({
    queries: [
      {
        queryKey: ["overview", selectedClusterId],
        queryFn: () => apiClient.getOverview(selectedClusterId!),
        enabled: !!selectedClusterId,
        retry: 1,
      },
      {
        queryKey: ["overview", "historical", selectedClusterId, historicalMetric, historicalDateRange.startTime, historicalDateRange.endTime],
        queryFn: () =>
          apiClient.getHistoricalTimeline(
            selectedClusterId!,
            historicalMetric,
            historicalDateRange.startTime,
            historicalDateRange.endTime
          ),
        enabled: !!selectedClusterId,
        retry: 1,
      },
      {
        queryKey: ["overview", "historical", "cost", selectedClusterId, historicalDateRange.startTime, historicalDateRange.endTime],
        queryFn: () =>
          apiClient.getHistoricalTimeline(
            selectedClusterId!,
            "cost",
            historicalDateRange.startTime,
            historicalDateRange.endTime
          ),
        enabled: !!selectedClusterId,
        retry: 1,
      },
    ],
  });

  const rawData = overviewResult.data;
  const error = overviewResult.error;
  const isLoading = overviewResult.isLoading;
  const d = withDefaults(error ? null : rawData);

  const historicalRaw = historicalResult.data;
  const isLoadingHistorical = historicalResult.isLoading;

  const costHistoricalRaw = costHistoricalResult.data;
  const isLoadingCostHistorical = costHistoricalResult.isLoading;

  const { data: historicalTimelineData, config: historicalChartConfig } = useMemo(
    () => transformHistoricalTimelineResponse(historicalRaw),
    [historicalRaw]
  );

  const historicalSeriesKeys = useMemo(
    () => Object.keys(historicalChartConfig).filter((k) => k !== "time"),
    [historicalChartConfig]
  );

  const { data: costTimelineData, config: costChartConfig } = useMemo(
    () => transformHistoricalTimelineResponse(costHistoricalRaw),
    [costHistoricalRaw]
  );
  const costSeriesKeys = useMemo(
    () =>
      Object.keys(costChartConfig).filter(
        (k) => k !== "time" && !/cumulative|savings/i.test((costChartConfig[k]?.label as string) ?? k)
      ),
    [costChartConfig]
  );

  const savingsPercent =
    d.currentMonthlyCost + d.currentSavings > 0
      ? Math.round(
          (d.currentSavings / (d.currentMonthlyCost + d.currentSavings)) * 100
        )
      : 0;

  const adoptionTotal = d.adoption.optimizable + d.adoption.optimizableButExcluded;
  const adoptionPercent =
    adoptionTotal > 0
      ? Math.round((d.adoption.optimizable / adoptionTotal) * 100)
      : 0;

  const cpuCoverageTotal = d.cpuCoverage.enabled + d.cpuCoverage.disabled;
  const cpuCoveragePercent =
    cpuCoverageTotal > 0
      ? Math.round((d.cpuCoverage.enabled / cpuCoverageTotal) * 100)
      : 0;

  const memCoverageTotal = d.memoryCoverage.enabled + d.memoryCoverage.disabled;
  const memCoveragePercent =
    memCoverageTotal > 0
      ? Math.round((d.memoryCoverage.enabled / memCoverageTotal) * 100)
      : 0;

  const optimizableButExcludedCount = d.adoption.optimizableButExcluded;
  const hasNoWorkloads = !isLoading && !error && adoptionTotal === 0;
  const pctCpuUsed =
    d.cpuStats.allocatable > 0
      ? (d.cpuStats.usage / d.cpuStats.allocatable) * 100
      : 0;
  const pctCpuReq =
    d.cpuStats.allocatable > 0
      ? (d.cpuStats.requested / d.cpuStats.allocatable) * 100
      : 0;
  const pctMemUsed =
    d.memoryStats.allocatable > 0
      ? (d.memoryStats.usage / d.memoryStats.allocatable) * 100
      : 0;
  const pctMemReq =
    d.memoryStats.allocatable > 0
      ? (d.memoryStats.requested / d.memoryStats.allocatable) * 100
      : 0;

  if (!selectedClusterId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please select a cluster to view the overview.
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full animate-fade-in">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error loading overview</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Failed to load overview data. Try refreshing or selecting another cluster."}
            </AlertDescription>
          </Alert>
        )}
        {!isLoading &&
          !error &&
          d.cpuStats.recommended === 0 &&
          d.memoryStats.recommended === 0 && (
          <Alert className="border-primary/30 bg-primary/5">
            <Activity className="h-4 w-4" />
            <AlertTitle>Recommendations are being generated</AlertTitle>
            <AlertDescription>
              Savings and untapped savings will appear here once recommendations are ready. This may take a few minutes after the cluster is connected.
            </AlertDescription>
          </Alert>
        )}
        {hasNoWorkloads && (
          <Alert className="border-muted-foreground/30 bg-muted/30">
            <Activity className="h-4 w-4" />
            <AlertTitle>Stats are still updating</AlertTitle>
            <AlertDescription>
              Workload stats have not been generated yet. It may take 5-10 minutes for the overview to populate after the cluster is connected.
            </AlertDescription>
          </Alert>
        )}
        {/* Top row: 4 metric cards */}
        <section aria-labelledby="overview-metrics-heading">
          <h2 id="overview-metrics-heading" className="sr-only">
            Key metrics
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card border-border">
              {isLoading ? (
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
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Monthly cost
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none" onClick={(e) => e.stopPropagation()} aria-label="How monthly cost is calculated">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
                            <p>
                              Monthly cost is computed from cluster allocatable resources (CPU cores and memory) and your configured cost per core/hour and per GB/hour. It represents the monthly run-rate if all allocatable capacity were billed at those rates.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      ${d.currentMonthlyCost.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">/month run-rate</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              )}
            </div>

            <div className="metric-card border-border">
              {isLoading ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Current savings
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none" onClick={(e) => e.stopPropagation()} aria-label="How current savings is calculated">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
                            <p>
                              Savings already realized from CruiseKube optimizations (resources right-sized on workloads in Cruise mode). The percentage is reduction relative to cost before optimization.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      ${d.currentSavings.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${savingsPercent}% reduction
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                </div>
              )}
            </div>

            <div className="metric-card border-border">
              {isLoading ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Cluster utilization
                    </p>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      {d.clusterUtilisation}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      usage / allocatable
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>
              )}
            </div>

            <div className="metric-card border-border">
              {isLoading ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                    <Server className="h-5 w-5" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Node count
                    </p>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      {d.nodeCount > 0 ? d.nodeCount : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">active nodes</p>
                  </div>
                  {d.nodeCount === 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground cursor-help">
                            <Server className="h-5 w-5" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Node count not available or zero.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {d.nodeCount > 0 && (
                    <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                      <Server className="h-5 w-5" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Middle: CruiseKube Adoption + Untapped Savings */}
        <section aria-labelledby="adoption-heading" className="grid gap-4 md:grid-cols-3">
          <div
            id="adoption-heading"
            className="metric-card border-border md:col-span-2 flex flex-col sm:flex-row items-stretch gap-6"
          >
            {isLoading ? (
              <div className="flex-1 flex items-center gap-6">
                <Skeleton className="h-32 w-32 rounded-full shrink-0" />
                <div className="space-y-4 flex-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="relative h-32 w-32">
                    <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-muted/60"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-primary"
                        strokeWidth="3"
                        strokeDasharray={`${adoptionPercent} ${100 - adoptionPercent}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-2xl font-bold text-foreground">
                        {adoptionPercent}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        optimizable
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-4 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    CruiseKube adoption
                  </p>
                  <div>
                    <p className="text-sm text-muted-foreground">Workloads</p>
                    <p className="font-mono text-lg font-semibold text-foreground">
                      {d.adoption.optimizable} / {adoptionTotal || 0}
                    </p>
                    {/*<p className="text-xs text-muted-foreground mt-1">
                      Optimizable: {d.adoption.optimizable} · Non-optimizable: {d.adoption.nonOptimizable} · Optimizable but non-optimizable: {d.adoption.optimizableButExcluded}
                    </p>*/}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>CPU coverage</span>
                        <span>
                          {cpuCoveragePercent}% enabled{" "}
                          <span className="text-muted-foreground/80">
                            {100 - cpuCoveragePercent}% disabled
                          </span>
                        </span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${cpuCoveragePercent}%` }}
                        />
                        <div
                          className="h-full bg-warning/60 transition-all"
                          style={{ width: `${100 - cpuCoveragePercent}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Memory coverage</span>
                        <span>
                          {memCoveragePercent}% enabled{" "}
                          <span className="text-muted-foreground/80">
                            {100 - memCoveragePercent}% disabled
                          </span>
                        </span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${memCoveragePercent}%` }}
                        />
                        <div
                          className="h-full bg-warning/60 transition-all"
                          style={{ width: `${100 - memCoveragePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="metric-card border border-warning/50 bg-warning/5">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Untapped savings
                  </p>
                </div>
                <p className="font-mono text-2xl font-semibold tracking-tight text-foreground mt-1">
                  ${d.possibleSavings !== 0 ? Math.round(d.possibleSavings - d.currentSavings).toLocaleString() : "0"}/mo
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {optimizableButExcludedCount === 0 ? (
                    "All eligible workloads have CruiseKube enabled. You're on maximum savings right now."
                  ) : (
                    <>
                      Enable CruiseKube on the remaining{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/workloads")}
                        className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                      >
                        {optimizableButExcludedCount} workloads
                      </button>{" "}
                      to unlock additional monthly savings.
                    </>
                  )}
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="mt-4 w-fit gap-1.5 shadow-sm ring-1 ring-primary/20"
                  onClick={() => navigate("/workloads")}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  View Workloads
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Bottom: CPU & Memory efficiency */}
        <section aria-labelledby="efficiency-heading">
          <div className="mb-4 flex items-center gap-2">
            <h2
              id="efficiency-heading"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Resource efficiency
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Resource efficiency metrics explained"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm p-4 text-left text-xs">
                  <p className="font-medium mb-2">Cluster-wide CPU and memory metrics (Kubernetes):</p>
                  <ul className="space-y-1.5 list-none">
                    <li><strong>Allocatable</strong> — Total capacity the scheduler can assign to pods (node capacity minus system/kube-reserved).</li>
                    <li><strong>Requested</strong> — Sum of resource requests from all pods in the cluster.</li>
                    <li><strong>Original Requested</strong> — Total CPU/memory requested by workloads from manifests (cluster-wide).</li>
                    <li><strong>Recommended</strong> — CruiseKube’s recommended total after applying right-sizing suggestions cluster-wide.</li>
                    <li><strong>Usage</strong> — Actual current usage from cluster metrics.</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="metric-card border-border space-y-4">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-48" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      CPU
                    </span>
                  </div>
                  <div className="grid gap-2 text-xs grid-cols-5">
                    <div>
                      <p className="text-muted-foreground uppercase">Allocatable</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(d.cpuStats.allocatable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Requested</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(d.cpuStats.requested)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Original Req.</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(d.cpuStats.workloadRequested ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Recommended</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(d.cpuStats.recommended)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Usage</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(d.cpuStats.usage)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Efficiency
                    </p>
                    <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted/60">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, pctCpuUsed)}%` }}
                        title={`${Math.round(pctCpuUsed)}% utilized`}
                      />
                      <div
                        className="h-full bg-muted-foreground/30 transition-all"
                        style={{
                          width: `${Math.min(100 - pctCpuUsed, Math.max(0, pctCpuReq - pctCpuUsed))}%`,
                        }}
                        title={`${Math.round(pctCpuReq)}% requested`}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{Math.round(pctCpuUsed)}% utilized</span>
                      <span>{Math.round(pctCpuReq)}% requested</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="metric-card border-border space-y-4">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-48" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Memory
                    </span>
                  </div>
                  <div className="grid gap-2 text-xs grid-cols-5">
                    <div>
                      <p className="text-muted-foreground uppercase">Allocatable</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(d.memoryStats.allocatable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Requested</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(d.memoryStats.requested)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Original Req.</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(d.memoryStats.workloadRequested ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Recommended</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(d.memoryStats.recommended)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Usage</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(d.memoryStats.usage)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Efficiency
                    </p>
                    <div className="flex h-6 w-full overflow-hidden rounded-md bg-muted/60">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, pctMemUsed)}%` }}
                        title={`${Math.round(pctMemUsed)}% utilized`}
                      />
                      <div
                        className="h-full bg-muted-foreground/30 transition-all"
                        style={{
                          width: `${Math.min(100 - pctMemUsed, Math.max(0, pctMemReq - pctMemUsed))}%`,
                        }}
                        title={`${Math.round(pctMemReq)}% requested`}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{Math.round(pctMemUsed)}% utilized</span>
                      <span>{Math.round(pctMemReq)}% requested</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

    {/* Time range (for Historical + Cost timelines) */}
        <section aria-labelledby="time-range-heading" className="space-y-3">
          <h2
            id="time-range-heading"
            className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Time range
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5">
              <Button
                variant={timeRangePreset === "6h" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setTimeRangePreset("6h")}
              >
                6 hours
              </Button>
              <Button
                variant={timeRangePreset === "24h" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setTimeRangePreset("24h")}
              >
                24 hours
              </Button>
              <Button
                variant={timeRangePreset === "7d" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setTimeRangePreset("7d")}
              >
                7 days
              </Button>
              <Button
                variant={timeRangePreset === "30d" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setTimeRangePreset("30d")}
              >
                30 days
              </Button>
              <Button
                variant={timeRangePreset === "custom" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  setTimeRangePreset("custom");
                  if (!customStart || !customEnd) {
                    const end = new Date();
                    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setCustomEnd(end.toISOString().slice(0, 16));
                    setCustomStart(start.toISOString().slice(0, 16));
                  }
                }}
              >
                Custom
              </Button>
            </div>
            {timeRangePreset === "custom" && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="timeline-start" className="text-xs text-muted-foreground whitespace-nowrap">
                    Start
                  </Label>
                  <Input
                    id="timeline-start"
                    type="datetime-local"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 text-xs w-[11rem]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="timeline-end" className="text-xs text-muted-foreground whitespace-nowrap">
                    End
                  </Label>
                  <Input
                    id="timeline-end"
                    type="datetime-local"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 text-xs w-[11rem]"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

    {/* Historical Timeline */}
	    <section aria-labelledby="historical-timeline-heading" className="space-y-4">
	          <div className="flex flex-wrap items-center justify-between gap-4">
	            <div className="flex items-center gap-1.5">
	              <h2
	                id="historical-timeline-heading"
	                className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
	              >
	                Historical timeline
	              </h2>
	              <TooltipProvider>
	                <Tooltip>
	                  <TooltipTrigger asChild>
	                    <button
	                      type="button"
	                      className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none"
	                      onClick={(e) => e.stopPropagation()}
	                      aria-label="Historical timeline explained"
	                    >
	                      <Info className="h-3.5 w-3.5" />
	                    </button>
	                  </TooltipTrigger>
	                  <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
	                    <div className="space-y-2">
	                      <p className="font-medium text-foreground">Historical timeline</p>
	                      <p className="text-xs text-muted-foreground">
	                        Shows resource history for the selected time range. Switch between CPU and memory to compare allocatable capacity, requests, recommendations, and observed usage over time.
	                      </p>
	                      <ul className="space-y-1 text-xs text-muted-foreground">
	                        <li>Allocatable: total cluster capacity available to schedule workloads.</li>
	                        <li>Requested: the cluster&apos;s current requested resources at that point in time.</li>
	                        <li>Original Requested: the resources configured at the workload level before CruiseKube recommendations are applied.</li>
	                        <li>Recommended: CruiseKube&apos;s suggested total after rightsizing.</li>
	                        <li>Usage: actual observed resource consumption.</li>
	                      </ul>
	                    </div>
	                  </TooltipContent>
	                </Tooltip>
	              </TooltipProvider>
	            </div>
	            <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5">
              <Button
                variant={historicalMetric === "cpu" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setHistoricalMetric("cpu")}
              >
                CPU
              </Button>
              <Button
                variant={historicalMetric === "memory" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setHistoricalMetric("memory")}
              >
                Memory
              </Button>
            </div>
          </div>
          <div className="metric-card border-border overflow-hidden">
            {isLoading || isLoadingHistorical ? (
              <Skeleton className="h-[320px] w-full" />
            ) : historicalTimelineData.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                No historical data for this period
              </div>
            ) : (
              <ChartContainer
                config={historicalChartConfig}
                className="h-[320px] w-full"
              >
                <ComposedChart data={historicalTimelineData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    unit={historicalMetric === "cpu" ? " cores" : " GB"}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const sorted = [...payload].sort(
                        (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
                      );
                      return (
                        <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <div className="grid gap-1.5">
                            {sorted.map((item) => (
                              <div
                                key={item.dataKey}
                                className="flex flex-1 justify-between items-center gap-4"
                              >
                                <span
                                  className="font-medium"
                                  style={{ color: `var(--color-${String(item.name)})` }}
                                >
                                  {String(historicalChartConfig[item.name as keyof typeof historicalChartConfig]?.label ?? item.name)}
                                </span>
                                <span className="font-mono font-medium tabular-nums text-foreground">
                                  {historicalMetric === "cpu"
                                    ? `${Number(item.value).toLocaleString()} cores`
                                    : `${Number(item.value).toLocaleString()} GB`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {historicalSeriesKeys.map((key) =>
                    key === "currentAllocatable" ? (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        fill={`var(--color-${key})`}
                        fillOpacity={0.3}
                        stroke={`var(--color-${key})`}
                        strokeWidth={2.5}
                      />
                    ) : (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={`var(--color-${key})`}
                        strokeWidth={3}
                        dot={false}
                      />
                    )
                  )}
                </ComposedChart>
              </ChartContainer>
            )}
          </div>
        </section>

	        {/* Cost Timeline */}
	        <section aria-labelledby="cost-timeline-heading" className="space-y-4">
	          <div className="flex items-center gap-1.5">
	            <h2
	              id="cost-timeline-heading"
	              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
	            >
	              Cost timeline
	            </h2>
	            <TooltipProvider>
	              <Tooltip>
	                <TooltipTrigger asChild>
	                  <button
	                    type="button"
	                    className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none"
	                    onClick={(e) => e.stopPropagation()}
	                    aria-label="Cost timeline explained"
	                  >
	                    <Info className="h-3.5 w-3.5" />
	                  </button>
	                </TooltipTrigger>
	                <TooltipContent side="bottom" className="max-w-sm p-4 text-left">
	                  <div className="space-y-2">
	                    <p className="font-medium text-foreground">Cost timeline</p>
	                    <p className="text-xs text-muted-foreground">
	                      Shows how monthly run-rate and savings trend across the selected time range using the timeline window selected above.
	                    </p>
	                    <ul className="space-y-1 text-xs text-muted-foreground">
	                      <li>Hourly Cost Without CruiseKube: estimated hourly cost before CruiseKube optimization.</li>
	                      <li>Hourly Cost: the effective current hourly cost reflected in the cluster.</li>
	                      <li>Hourly Cost With CruiseKube: estimated hourly cost after applying CruiseKube optimization.</li>
	                    </ul>
	                  </div>
	                </TooltipContent>
	              </Tooltip>
	            </TooltipProvider>
	          </div>
	          <div className="metric-card border-border overflow-hidden">
            {isLoading || isLoadingCostHistorical ? (
              <Skeleton className="h-[320px] w-full" />
            ) : costTimelineData.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                No historical cost data for this period
              </div>
            ) : (
              <ChartContainer
                config={costChartConfig}
                className="h-[320px] w-full"
              >
                <ComposedChart data={costTimelineData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const sorted = [...payload].sort(
                        (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
                      );
                      return (
                        <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <div className="grid gap-1.5">
                            {sorted.map((item) => (
                              <div
                                key={item.dataKey}
                                className="flex flex-1 justify-between items-center gap-4"
                              >
                                <span
                                  className="font-medium"
                                  style={{ color: `var(--color-${String(item.name)})` }}
                                >
                                  {String(costChartConfig[item.name as keyof typeof costChartConfig]?.label ?? item.name)}
                                </span>
                                <span className="font-mono font-medium tabular-nums text-foreground">
                                  ${Number(item.value).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {costSeriesKeys.map((key) =>
                    key === "currentAllocatable" ? (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        fill={`var(--color-${key})`}
                        fillOpacity={0.3}
                        stroke={`var(--color-${key})`}
                        strokeWidth={2.5}
                      />
                    ) : (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={`var(--color-${key})`}
                        strokeWidth={3}
                        dot={false}
                      />
                    )
                  )}
                </ComposedChart>
              </ChartContainer>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

import { DollarSign, TrendingDown, Activity, Server, Zap, Cpu, HardDrive, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { asArray } from "@/lib/utils";

function formatCpuValue(value: number): string {
  return `${value.toFixed(1)} cores`;
}
function formatMemoryValue(value: number): string {
  return `${value.toFixed(1)} GiB`;
}

export default function Overview() {
  const navigate = useNavigate();
  const { selectedClusterId } = useCluster();

  const { data: summaryData, isLoading, error } = useQuery({
    queryKey: ["workloads-summary", selectedClusterId],
    queryFn: () => apiClient.getWorkloadsSummary(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const impactSummary = summaryData?.impactSummary;
  const clusterResources = impactSummary?.clusterResources;
  const workloadDetails = asArray(summaryData?.workloadDetails ?? []);

  const currentCostDollars = impactSummary?.dollarCurrentCost ?? 0;
  const currentSavingsDollars = impactSummary?.dollarCurrentSavings ?? 0;
  const possibleSavingsDollars = impactSummary?.dollarPossibleSavings ?? 0;
  const workloadCostDollars = currentCostDollars + currentSavingsDollars;
  const savingsPercent =
    workloadCostDollars > 0
      ? Math.round((currentSavingsDollars / workloadCostDollars) * 100)
      : 0;

  const cpuAlloc = Number(clusterResources?.cpu?.allocatable ?? 0);
  const cpuReq = Number(clusterResources?.cpu?.requested ?? 0);
  const cpuUsed = Number(clusterResources?.cpu?.utilised ?? 0);
  const memAlloc = Number(clusterResources?.memory?.allocatable ?? 0);
  const memReq = Number(clusterResources?.memory?.requested ?? 0);
  const memUsed = Number(clusterResources?.memory?.utilised ?? 0);

  const cpuRecommendedTotal = workloadDetails.reduce(
    (sum, w) => sum + (w.cpu?.recommended?.max ?? 0),
    0
  );
  const memRecommendedTotal = workloadDetails.reduce(
    (sum, w) => sum + (w.memory?.recommended?.max ?? 0),
    0
  );
  const memRecommendedGiB = memRecommendedTotal / 1024;

  const clusterUtilization =
    cpuAlloc > 0 && memAlloc > 0
      ? Math.round(
          ((cpuUsed / cpuAlloc + memUsed / memAlloc) / 2) * 100
        )
      : 0;

  const enabledCount = workloadDetails.filter((w) => w.config?.cruiseEnabled).length;
  const totalWorkloads = workloadDetails.length;
  const adoptionPercent =
    totalWorkloads > 0 ? Math.round((enabledCount / totalWorkloads) * 100) : 0;

  const cpuRequestedEnabled = workloadDetails
    .filter((w) => w.config?.cruiseEnabled)
    .reduce((sum, w) => sum + (w.cpu?.current ?? 0), 0);
  const cpuRequestedTotal = workloadDetails.reduce(
    (sum, w) => sum + (w.cpu?.current ?? 0),
    0
  );
  const cpuCoveragePercent =
    cpuRequestedTotal > 0
      ? Math.round((cpuRequestedEnabled / cpuRequestedTotal) * 100)
      : 0;

  const memRequestedEnabled = workloadDetails
    .filter((w) => w.config?.cruiseEnabled)
    .reduce((sum, w) => sum + (w.memory?.current ?? 0), 0);
  const memRequestedTotal = workloadDetails.reduce(
    (sum, w) => sum + (w.memory?.current ?? 0),
    0
  );
  const memCoveragePercent =
    memRequestedTotal > 0
      ? Math.round((memRequestedEnabled / memRequestedTotal) * 100)
      : 0;

  const disabledCount = totalWorkloads - enabledCount;
  const untappedSavings = workloadDetails
    .filter((w) => !w.config?.cruiseEnabled)
    .reduce((sum, w) => sum + (w.dollarSavingsPerMonth ?? 0), 0);

  const cpuOverProvisioned = Math.max(0, cpuReq - cpuRecommendedTotal);
  const cpuOverProvisionedPercent =
    cpuReq > 0 ? Math.round((cpuOverProvisioned / cpuReq) * 100) : 0;
  const memOverProvisionedGiB = Math.max(0, memReq / 1024 - memRecommendedGiB);
  const memOverProvisionedPercent =
    memReq > 0
      ? Math.round((memOverProvisionedGiB / (memReq / 1024)) * 100)
      : 0;

  const pctCpuUsed = cpuAlloc > 0 ? (cpuUsed / cpuAlloc) * 100 : 0;
  const pctCpuReq = cpuAlloc > 0 ? (cpuReq / cpuAlloc) * 100 : 0;
  const pctMemUsed = memAlloc > 0 ? (memUsed / memAlloc) * 100 : 0;
  const pctMemReq = memAlloc > 0 ? (memReq / memAlloc) * 100 : 0;

  if (!selectedClusterId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please select a cluster to view the overview.
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="p-6 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error loading overview</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full animate-fade-in">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cluster metrics, CruiseKube adoption, and resource efficiency
            </p>
          </div>
        </header>

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
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Monthly cost
                    </p>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      ${currentCostDollars.toLocaleString()}
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
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Current savings
                    </p>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                      ${currentSavingsDollars.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {savingsPercent}% reduction
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
                      {clusterUtilization}%
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
                      —
                    </p>
                    <p className="text-sm text-muted-foreground">active nodes</p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground cursor-help">
                          <Server className="h-5 w-5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Node count is not available in the current API.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                        enabled
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
                      {enabledCount} / {totalWorkloads}
                    </p>
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
                  ${Math.round(untappedSavings).toLocaleString()}/mo
                </p>
                <p className="text-sm text-muted-foreground mt-2 flex-1">
                  Enable CruiseKube on the remaining{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/workloads")}
                    className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    {disabledCount} workloads
                  </button>{" "}
                  to unlock additional monthly savings.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Bottom: CPU & Memory efficiency */}
        <section aria-labelledby="efficiency-heading">
          <h2
            id="efficiency-heading"
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Resource efficiency
          </h2>
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
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground uppercase">Allocatable</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(cpuAlloc)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Requested</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(cpuReq)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Usage</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(cpuUsed)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Recommended</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatCpuValue(cpuRecommendedTotal)}
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
                  {cpuOverProvisioned > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ↓ Over-provisioned by{" "}
                      <span className="font-semibold text-primary">
                        {formatCpuValue(cpuOverProvisioned)} ({cpuOverProvisionedPercent}%)
                      </span>
                    </p>
                  )}
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
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground uppercase">Allocatable</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(memAlloc / 1024)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Requested</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(memReq / 1024)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Usage</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(memUsed / 1024)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase">Recommended</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatMemoryValue(memRecommendedGiB)}
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
                  {memOverProvisionedGiB > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ↓ Over-provisioned by{" "}
                      <span className="font-semibold text-primary">
                        {formatMemoryValue(memOverProvisionedGiB)} (
                        {memOverProvisionedPercent}%)
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

import { useParams, Link } from "react-router-dom";
import { Fragment, type ReactNode } from "react";
import {
  ArrowLeft,
  Box,
  ChevronRight,
  Cpu,
  HardDrive,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { SectionHeader } from "@/components/layout/SectionHeader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient } from "@/lib/api";
import { formatCpu, formatMemory, formatCpuSigned, formatMemorySigned } from "@/lib/transformers";
import { asArray } from "@/lib/utils";

const WORKLOAD_COLUMN_TOOLTIP =
  "Represents the resource set in the configuration of workload.";
const CURRENT_COLUMN_TOOLTIP = "Current pod resource.";
const RECOMMENDED_COLUMN_TOOLTIP = "What cruiseKube recommends.";

function BackToWorkloadsAction() {
  return (
    <Button variant="outline" asChild>
      <Link to="/workloads">
        <ArrowLeft className="h-4 w-4" />
        Back to workloads
      </Link>
    </Button>
  );
}

function WorkloadDetailHeader({
  title = "Workload detail",
  description = "Inspect workload-level recommendations and container resource targets.",
  icon = <Box className="h-5 w-5" />,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <PageHeader
      icon={icon}
      title={title}
      description={description}
      actions={<BackToWorkloadsAction />}
    />
  );
}

function ResourceGroupHeader({ icon: Icon, label }: { icon: typeof Cpu; label: string }) {
  return (
    <th
      colSpan={3}
      className="select-none border-t border-l border-r border-b-0 border-border bg-muted/40 font-medium align-middle text-center normal-case py-2 px-0 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </span>
      </div>
    </th>
  );
}

function ResourceSubHeader({ label, description, edge }: { label: string; description: string; edge?: "left" | "right" }) {
  return (
    <th className={`select-none border-b ${edge === "left" ? "border-l" : ""} ${edge === "right" ? "border-r" : ""} border-border bg-muted/30 align-middle normal-case text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 !text-right`}>
      <SubHeaderWithTooltip label={label} description={description} />
    </th>
  );
}

function SubHeaderWithTooltip({ label, description }: { label: string; description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex w-full cursor-help items-center justify-end gap-1 pr-2 py-1.5">
          <span>{label}</span>
          <Info className="h-3 w-3 shrink-0 text-muted-foreground opacity-70" aria-hidden />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

export default function WorkloadDetail() {
  const { namespace, workloadName } = useParams();
  const { selectedClusterId } = useCluster();

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['workload-detail', selectedClusterId, namespace, workloadName],
    queryFn: () => apiClient.getWorkloadDetail(selectedClusterId!, namespace!, workloadName!),
    enabled: !!selectedClusterId && !!namespace && !!workloadName,
  });

  if (!selectedClusterId) {
    return (
      <PageShell className="animate-fade-in">
<WorkloadDetailHeader />
        <EmptyState
          title="Select a cluster"
          description="Please select a cluster to view workload details."
        />
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell className="animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Skeleton className="h-4 w-32" />
        </div>
        
        <WorkloadDetailHeader
          icon={<Skeleton className="h-5 w-5" />}
          title={<Skeleton className="h-8 w-48" />}
          description={<Skeleton className="h-4 w-72 max-w-full" />}
        />

        <LoadingState
          className="min-h-[160px]"
          title="Loading workload details"
          description="Fetching pods, containers, and recommendations for this workload."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="overflow-hidden">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Panel>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell className="animate-fade-in">
<WorkloadDetailHeader />
        <ErrorState
          title="Error loading workload data"
          description={error instanceof Error ? error.message : 'Unknown error'}
        />
      </PageShell>
    );
  }

  if (!detail) {
    return (
      <PageShell className="animate-fade-in">
<WorkloadDetailHeader />
        <EmptyState
          title="Workload not found"
          description="The requested workload was not returned for the selected cluster."
        />
      </PageShell>
    );
  }

  const pods = asArray(detail.pods);

  return (
    <PageShell className="animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/workloads" className="hover:text-foreground transition-colors">
          Workloads & Recommendations
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-mono">{detail.namespace}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="min-w-0 truncate text-foreground">{detail.workload}</span>
      </nav>

      {/* Header */}
      <WorkloadDetailHeader
        title={detail.workload}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{detail.namespace}</span>
            <span aria-hidden className="text-muted-foreground/70">•</span>
            <span>{detail.type}</span>
          </span>
        }
      />

      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertTitle>Recommendation comparison</AlertTitle>
        <AlertDescription>
          Workload values are from the configured manifest, current values are observed pod resources, and recommended values are CruiseKube targets.
        </AlertDescription>
      </Alert>

      {/* Savings Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">CPU Savings</p>
              <p className="font-mono text-xl font-semibold text-foreground">{formatCpuSigned(-detail.potential_cpu_savings)}</p>
              <p className="text-xs text-muted-foreground">
                {detail.potential_cpu_savings > 0
                  ? "CPU reduced"
                  : detail.potential_cpu_savings < 0
                    ? "CPU increased to improve reliability"
                    : "No change"}
              </p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Memory Savings</p>
              <p className="font-mono text-xl font-semibold text-foreground">{formatMemorySigned(-detail.potential_mem_savings)}</p>
              <p className="text-xs text-muted-foreground">
                {detail.potential_mem_savings > 0
                  ? "Memory reduced"
                  : detail.potential_mem_savings < 0
                    ? "Memory increased to improve reliability"
                    : "No change"}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Pods & Containers Table */}
      <Panel className="overflow-hidden" padding="none">
        <div className="p-5 pb-4">
          <SectionHeader
            title="Pods & Containers"
            description="Review configured, current, and recommended CPU and memory requests for each container."
            helpText="Positive deltas indicate recommended increases; negative deltas indicate potential resource reductions."
          />
        </div>
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={300}>
            <table className="data-table data-table-compact w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="select-none align-middle border-b border-border transition-colors hover:bg-muted/50"
                >
                  Pod
                </th>
                <th
                  rowSpan={2}
                  className="select-none align-middle border-b border-border transition-colors hover:bg-muted/50"
                >
                  Node
                </th>
                <th
                  rowSpan={2}
                  className="select-none align-middle border-b border-border !text-center text-center transition-colors hover:bg-muted/50"
                >
                  <div className="flex w-full items-center justify-center px-2 py-2 normal-case">
                    Container Name
                  </div>
                </th>
                <ResourceGroupHeader icon={Cpu} label="CPU" />
                <ResourceGroupHeader icon={HardDrive} label="Memory" />
              </tr>
              <tr>
                <ResourceSubHeader edge="left" label="Workload" description={WORKLOAD_COLUMN_TOOLTIP} />
                <ResourceSubHeader label="Current" description={CURRENT_COLUMN_TOOLTIP} />
                <ResourceSubHeader edge="right" label="Rec" description={RECOMMENDED_COLUMN_TOOLTIP} />
                <ResourceSubHeader edge="left" label="Workload" description={WORKLOAD_COLUMN_TOOLTIP} />
                <ResourceSubHeader label="Current" description={CURRENT_COLUMN_TOOLTIP} />
                <ResourceSubHeader edge="right" label="Rec" description={RECOMMENDED_COLUMN_TOOLTIP} />
              </tr>
            </thead>
            <tbody>
              {pods.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8">
                    <EmptyState
                      className="min-h-[180px] border-dashed shadow-none"
                      title="No pods found"
                      description="No pods were returned for this workload."
                    />
                  </td>
                </tr>
              ) : (
                pods.map((pod) => (
                  <Fragment key={pod.pod_name}>
                    <tr className="bg-surface-subtle/70">
                      <td className="font-mono text-sm font-medium py-2 px-4">{pod.pod_name}</td>
                      <td className="font-mono text-xs text-muted-foreground py-2 px-4">
                        {pod.node_name ?? "—"}
                      </td>
                      <td className="border-b border-border bg-surface-subtle/70 py-2" aria-hidden />
                      <td className="border-b border-l border-border bg-surface-subtle/60 py-2" aria-hidden />
                      <td className="border-b border-border bg-surface-subtle/60 py-2" aria-hidden />
                      <td className="border-b border-r border-border bg-surface-subtle/60 py-2" aria-hidden />
                      <td className="border-b border-l border-border bg-surface-subtle/60 py-2" aria-hidden />
                      <td className="border-b border-border bg-surface-subtle/60 py-2" aria-hidden />
                      <td className="border-b border-r border-border bg-surface-subtle/60 py-2" aria-hidden />
                    </tr>
                    {asArray(pod.containers).length > 0 ? (
                      asArray(pod.containers).map((container) => {
                        const cpuRequest =
                          container.current_cpu_request ?? container.cpu_request;
                        const memRequest =
                          container.current_mem_request ?? container.mem_request;
                        /** Recommended minus workload manifest (same sign idea as workloads list Rec delta). */
                        const deltaCpu =
                          container.cpu_rec_request - container.cpu_request;
                        const deltaMem =
                          container.mem_rec_request - container.mem_request;
                        const showCpuDelta = Math.abs(deltaCpu) > 1e-9;
                        const showMemDelta = Math.abs(deltaMem) > 1e-9;
                        const resTd =
                          "font-mono text-sm tabular-nums text-right bg-surface-subtle/35 border-b border-border align-middle px-2 py-2";
                        return (
                          <tr key={`${pod.pod_name}-${container.container_name}`}>
                            <td />
                            <td />
                            <td className="text-center align-middle font-medium px-2 py-2">
                              {container.container_name}
                            </td>
                            <td className={`${resTd} border-l text-muted-foreground`}>
                              {formatCpu(container.cpu_request)}
                            </td>
                            <td className={`${resTd}`}>{formatCpu(cpuRequest)}</td>
                            <td className={`${resTd} border-r text-primary`}>
                              {formatCpu(container.cpu_rec_request)}
                              {showCpuDelta && (
                                <span className={deltaCpu > 0 ? "text-warning" : "text-success"}>
                                  <br />
                                  <span className="opacity-70">({formatCpuSigned(deltaCpu)})</span>
                                </span>
                              )}
                            </td>
                            <td className={`${resTd} border-l text-muted-foreground`}>
                              {formatMemory(container.mem_request)}
                            </td>
                            <td className={`${resTd}`}>{formatMemory(memRequest)}</td>
                            <td className={`${resTd} border-r text-primary`}>
                              {formatMemory(container.mem_rec_request)}
                              {showMemDelta && (
                                <span className={deltaMem > 0 ? "text-warning" : "text-success"}>
                                  <br />
                                  <span className="opacity-70">({formatMemorySigned(deltaMem)})</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr key={`${pod.pod_name}-empty`}>
                        <td colSpan={9} className="text-muted-foreground text-sm py-3 px-4">
                          No containers found
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
          </TooltipProvider>
        </div>
      </Panel>
    </PageShell>
  );
}

import { useParams, Link } from "react-router-dom";
import { Fragment } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Cpu,
  HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient } from "@/lib/api";
import { formatCpu, formatMemory, formatCpuSigned, formatMemorySigned } from "@/lib/transformers";
import { asArray } from "@/lib/utils";

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
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Please select a cluster to view workload details.</p>
        <Link to="/workloads">
          <Button variant="link" className="mt-2">Back to workloads</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Skeleton className="h-4 w-32" />
        </div>
        
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="metric-card">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
        </div>

        <div className="metric-card overflow-hidden">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">
          Error loading workload data: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Link to="/workloads">
          <Button variant="link" className="mt-2">Back to workloads</Button>
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Workload not found</p>
        <Link to="/workloads">
          <Button variant="link" className="mt-2">Back to workloads</Button>
        </Link>
      </div>
    );
  }

  const pods = asArray(detail.pods);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/workloads" className="hover:text-foreground transition-colors">
          Workloads & Recommendations
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-mono">{detail.namespace}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{detail.workload}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/workloads">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{detail.workload}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="font-mono text-sm text-muted-foreground">{detail.namespace}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{detail.type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Savings Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card">
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
        </div>
        <div className="metric-card">
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
        </div>
      </div>

      {/* Pods & Containers Table */}
      <div className="metric-card overflow-hidden">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Pods & Containers
        </h3>
        <div className="overflow-x-auto">
          <table className="data-table data-table-compact w-full border-collapse">
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
                <th
                  colSpan={3}
                  className="select-none border-t border-l border-r border-b-0 border-border bg-muted/40 font-medium align-middle text-center normal-case py-2 px-0 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                      <Cpu className="h-4 w-4" />
                      CPU
                    </span>
                  </div>
                </th>
                <th
                  colSpan={3}
                  className="select-none border-t border-l border-r border-b-0 border-border bg-muted/40 font-medium align-middle text-center normal-case py-2 px-0 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                      <HardDrive className="h-4 w-4" />
                      Memory
                    </span>
                  </div>
                </th>
              </tr>
              <tr>
                <th className="select-none border-b border-l border-border bg-muted/30 align-middle normal-case text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 !text-right">
                  <div className="flex w-full items-center justify-end pr-2 py-1.5">Workload</div>
                </th>
                <th className="select-none border-b border-border bg-muted/30 align-middle normal-case text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 !text-right">
                  <div className="flex w-full items-center justify-end pr-2 py-1.5">Current</div>
                </th>
                <th className="select-none border-b border-r border-border bg-muted/30 align-middle normal-case text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 !text-right">
                  <div className="flex w-full items-center justify-end pr-2 py-1.5">Rec</div>
                </th>
                <th className="select-none border-b border-l border-border bg-muted/30 align-middle normal-case text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 !text-right">
                  <div className="flex w-full items-center justify-end pr-2 py-1.5">Workload</div>
                </th>
                <th className="select-none border-b border-border bg-muted/30 align-middle normal-case text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 !text-right">
                  <div className="flex w-full items-center justify-end pr-2 py-1.5">Current</div>
                </th>
                <th className="select-none border-b border-r border-border bg-muted/30 align-middle normal-case text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 !text-right">
                  <div className="flex w-full items-center justify-end pr-2 py-1.5">Rec</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {pods.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-8">
                    No pods found for this workload
                  </td>
                </tr>
              ) : (
                pods.map((pod) => (
                  <Fragment key={pod.pod_name}>
                    <tr className="bg-muted/50">
                      <td className="font-mono text-sm font-medium py-2 px-4">{pod.pod_name}</td>
                      <td className="font-mono text-xs text-muted-foreground py-2 px-4">
                        {pod.node_name ?? "—"}
                      </td>
                      <td className="border-b border-border bg-muted/50 py-2" aria-hidden />
                      <td className="border-b border-l border-border bg-muted/40 py-2" aria-hidden />
                      <td className="border-b border-border bg-muted/40 py-2" aria-hidden />
                      <td className="border-b border-r border-border bg-muted/40 py-2" aria-hidden />
                      <td className="border-b border-l border-border bg-muted/40 py-2" aria-hidden />
                      <td className="border-b border-border bg-muted/40 py-2" aria-hidden />
                      <td className="border-b border-r border-border bg-muted/40 py-2" aria-hidden />
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
                          "font-mono text-sm tabular-nums text-right bg-muted/20 border-b border-border align-middle px-2 py-2";
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
                                <span className={deltaCpu > 0 ? "text-amber-500 dark:text-amber-400" : ""}>
                                  <br />
                                  <span className="opacity-40">({formatCpuSigned(deltaCpu)})</span>
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
                                <span className={deltaMem > 0 ? "text-amber-500 dark:text-amber-400 opacity-100" : ""}>
                                  <br />
                                  <span className="opacity-40">({formatMemorySigned(deltaMem)})</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr key={`${pod.pod_name}-empty`}>
                        <td colSpan={9} className="text-muted-foreground text-sm py-2 px-4">
                          No containers found
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

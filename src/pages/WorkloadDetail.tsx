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
        <Link to="/">
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
        <Link to="/">
          <Button variant="link" className="mt-2">Back to workloads</Button>
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Workload not found</p>
        <Link to="/">
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
        <Link to="/" className="hover:text-foreground transition-colors">
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
          <Link to="/">
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
              <p className="text-xs text-muted-foreground uppercase tracking-wider">CPU Savings Potential</p>
              <p className="font-mono text-xl font-semibold text-foreground">{formatCpuSigned(-detail.potential_cpu_savings)}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Memory Savings Potential</p>
              <p className="font-mono text-xl font-semibold text-foreground">{formatMemorySigned(-detail.potential_mem_savings)}</p>
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Pod</th>
                <th>Node</th>
                <th>Container Name</th>
                <th>CPU Request</th>
                <th>CPU Recommended</th>
                <th>Memory Request</th>
                <th>Memory Recommended</th>
              </tr>
            </thead>
            <tbody>
              {pods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-8">
                    No pods found for this workload
                  </td>
                </tr>
              ) : (
                pods.map((pod) => (
                  <Fragment key={pod.pod_name}>
                    <tr className="bg-muted/50">
                      <td className="font-mono text-sm font-medium py-2 px-4">{pod.pod_name}</td>
                      <td className="font-mono text-xs text-muted-foreground py-2 px-4">{pod.node_name ?? "—"}</td>
                      <td colSpan={5}></td>
                    </tr>
                    {asArray(pod.containers).length > 0 ? (
                      asArray(pod.containers).map((container) => (
                        <tr key={`${pod.pod_name}-${container.container_name}`}>
                          <td></td>
                          <td></td>
                          <td className="font-medium">{container.container_name}</td>
                          <td className="font-mono text-sm">{formatCpu(container.cpu_request)}</td>
                          <td className="font-mono text-sm text-primary">{formatCpu(container.cpu_rec_request)}</td>
                          <td className="font-mono text-sm">{formatMemory(container.mem_request)}</td>
                          <td className="font-mono text-sm text-primary">{formatMemory(container.mem_rec_request)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr key={`${pod.pod_name}-empty`}>
                        <td colSpan={7} className="text-muted-foreground text-sm py-2 px-4">
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
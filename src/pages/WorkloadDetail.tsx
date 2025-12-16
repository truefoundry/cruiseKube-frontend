import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  ChevronRight, 
  Cpu, 
  HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient } from "@/lib/api";
import { transformWorkloadStatToContainers, transformWorkloadStatToFrontend } from "@/lib/transformers";

export default function WorkloadDetail() {
  const { namespace, workloadName } = useParams();
  const navigate = useNavigate();
  const { selectedClusterId } = useCluster();

  const { data: statsData, isLoading, error } = useQuery({
    queryKey: ['cluster-stats', selectedClusterId],
    queryFn: () => apiClient.getClusterStats(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const { data: recommendationAnalysis } = useQuery({
    queryKey: ['recommendation-analysis', selectedClusterId],
    queryFn: () => apiClient.getRecommendationAnalysis(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const workloadStat = statsData?.stats.find(
    (s) => s.namespace === namespace && s.name === workloadName
  );

  const containers = workloadStat ? transformWorkloadStatToContainers(workloadStat, recommendationAnalysis?.analysis) : [];
  const workload = workloadStat ? transformWorkloadStatToFrontend(workloadStat, undefined, recommendationAnalysis?.analysis) : null;

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
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Loading workload data...</p>
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

  if (!workload || !workloadStat) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Workload not found</p>
        <Link to="/workloads">
          <Button variant="link" className="mt-2">Back to workloads</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/workloads" className="hover:text-foreground transition-colors">
          Workloads & Recommendations
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-mono">{namespace}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{workloadName}</span>
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
            <h1 className="text-2xl font-semibold text-foreground">{workloadName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="font-mono text-sm text-muted-foreground">{namespace}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{workload.type}</span>
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
              <p className="font-mono text-xl font-semibold text-foreground">{workload.potentialCpu}</p>
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
              <p className="font-mono text-xl font-semibold text-foreground">{workload.potentialMem}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Containers Table */}
      <div className="metric-card overflow-hidden">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Containers
        </h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Container</th>
                <th>CPU Current</th>
                <th>CPU Recommended</th>
                <th>Memory Current</th>
                <th>Memory Recommended</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {containers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-8">
                    No containers found for this workload
                  </td>
                </tr>
              ) : (
                containers.map((container) => (
                  <tr 
                    key={container.name} 
                    className="group cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/workloads/${namespace}/${workloadName}/${container.name}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/workloads/${namespace}/${workloadName}/${container.name}`);
                      }
                    }}
                  >
                    <td className="font-medium">{container.name}</td>
                    <td className="font-mono text-sm">{container.cpuCurrent}</td>
                    <td className="font-mono text-sm text-primary">{container.cpuRecommended}</td>
                    <td className="font-mono text-sm">{container.memCurrent}</td>
                    <td className="font-mono text-sm text-primary">{container.memRecommended}</td>
                    <td>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
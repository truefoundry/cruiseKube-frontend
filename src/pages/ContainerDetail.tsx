import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient, RecommendationAnalysisItem } from "@/lib/api";
import { getPodRecommendationsForContainer, FrontendPodRecommendation } from "@/lib/transformers";

export default function ContainerDetail() {
  const { namespace, workloadName, containerName } = useParams();
  const { selectedClusterId } = useCluster();

  const { data: analysisData, isLoading, error } = useQuery({
    queryKey: ['recommendation-analysis', selectedClusterId],
    queryFn: () => apiClient.getRecommendationAnalysis(selectedClusterId!),
    enabled: !!selectedClusterId && !!namespace && !!workloadName && !!containerName,
  });

  let podRecommendations: FrontendPodRecommendation[] = [];
  let filteredAnalysisItems: RecommendationAnalysisItem[] = [];
  
  if (analysisData?.analysis) {
    filteredAnalysisItems = analysisData.analysis.filter(
      item => 
        item.workload_namespace === namespace && 
        item.workload_name === workloadName &&
        item.container_name === containerName
    );
    podRecommendations = getPodRecommendationsForContainer(filteredAnalysisItems, containerName!);
  }


  if (!selectedClusterId) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Please select a cluster to view container details.</p>
        <Link to={`/workloads/${namespace}/${workloadName}`}>
          <Button variant="link" className="mt-2">Back to workload</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Loading container data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">
          Error loading container data: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Link to={`/workloads/${namespace}/${workloadName}`}>
          <Button variant="link" className="mt-2">Back to workload</Button>
        </Link>
      </div>
    );
  }

  if (!namespace || !workloadName || !containerName) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Invalid container path</p>
        <Link to="/workloads">
          <Button variant="link" className="mt-2">Back to workloads</Button>
        </Link>
      </div>
    );
  }

  if (podRecommendations.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">No recommendations found for this container</p>
        <Link to={`/workloads/${namespace}/${workloadName}`}>
          <Button variant="link" className="mt-2">Back to workload</Button>
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
        <Link to={`/workloads/${namespace}/${workloadName}`} className="hover:text-foreground transition-colors font-mono">
          {workloadName}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{containerName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={`/workloads/${namespace}/${workloadName}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{containerName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Container in <span className="font-mono">{workloadName}</span>
          </p>
        </div>
      </div>

      {/* Per-Pod Recommendations Table */}
      <div className="metric-card overflow-hidden">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Per-Pod Recommendations
        </h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pod Name</th>
                <th>CPU Request</th>
                <th>CPU Recommended</th>
                <th>Memory Request</th>
                <th>Memory Recommended</th>
              </tr>
            </thead>
            <tbody>
              {podRecommendations.map((pod) => {
                return (
                  <tr key={pod.pod}>
                    <td className="font-mono text-xs">{pod.pod}</td>
                    <td className="font-mono text-sm">{pod.cpuRequest}</td>
                    <td className="font-mono text-sm text-primary">{pod.cpuRecRequest}</td>
                    <td className="font-mono text-sm">{pod.memRequest}</td>
                    <td className="font-mono text-sm text-primary">{pod.memRecRequest}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
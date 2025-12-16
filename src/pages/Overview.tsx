import { 
  DollarSign, 
  AlertTriangle,
  ExternalLink,
  TrendingDown
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient } from "@/lib/api";
import { 
  transformStatsToOverviewMetrics, 
  transformStatsToWastefulWorkloads,
  OverviewMetrics,
  WastefulWorkload
} from "@/lib/transformers";

export default function Overview() {
  const { selectedClusterId } = useCluster();

  const { data: statsData, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['cluster-stats', selectedClusterId],
    queryFn: () => apiClient.getClusterStats(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const { data: workloadsData } = useQuery({
    queryKey: ['workloads', selectedClusterId],
    queryFn: () => apiClient.getWorkloads(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const { data: recommendationAnalysis } = useQuery({
    queryKey: ['recommendation-analysis', selectedClusterId],
    queryFn: () => apiClient.getRecommendationAnalysis(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  let overviewMetrics: OverviewMetrics = {
    optimizationScore: 0,
    coverage: 0,
    potentialSavings: { cpu: 0, memory: 0, dollars: 0 },
    realizedSavings: { cpu: 0, memory: 0, dollars: 0 },
    reliabilityIssues: 0,
    costOptimizedWorkloads: 0,
    totalSavedPerHour: 0,
  };

  let wastefulWorkloads: WastefulWorkload[] = [];

  if (statsData) {
    overviewMetrics = transformStatsToOverviewMetrics(statsData, workloadsData || [], recommendationAnalysis?.analysis);
    wastefulWorkloads = transformStatsToWastefulWorkloads(statsData, workloadsData || [], 10, recommendationAnalysis?.analysis);
  }

  if (!selectedClusterId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please select a cluster to view overview metrics.
        </div>
      </div>
    );
  }

  if (isLoadingStats) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading overview data...</div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="p-6">
        <div className="text-center text-destructive">
          Error loading overview data: {statsError instanceof Error ? statsError.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">Cluster optimization at a glance</p>
        </div>
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
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Reliability Issues"
          value={overviewMetrics.reliabilityIssues}
          subtitle="Workloads at risk"
          icon={AlertTriangle}
          variant={overviewMetrics.reliabilityIssues > 10 ? "warning" : "default"}
        />
        <MetricCard
          title="Cost Optimized"
          value={overviewMetrics.costOptimizedWorkloads}
          subtitle="Workloads with savings"
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
      </div>

      {/* Top Wasteful Workloads */}
      <div className="metric-card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Top 10 Wasteful Workloads
          </h3>
          <Link to="/workloads">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              View all
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Namespace</th>
                <th>Workload</th>
                <th>Containers</th>
                <th>Savings / Month</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wastefulWorkloads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">
                    No wasteful workloads found
                  </td>
                </tr>
              ) : (
                wastefulWorkloads.map((workload, i) => (
                  <tr key={i} className="group cursor-pointer">
                    <td className="font-mono text-xs">{workload.namespace}</td>
                    <td className="font-medium">{workload.workload}</td>
                    <td className="text-muted-foreground">{workload.containers}</td>
                    <td className="font-mono text-primary">${workload.savingsPerHour}/month</td>
                    <td>
                      <Link to={`/workloads/${workload.namespace}/${workload.workload}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                          View
                        </Button>
                      </Link>
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
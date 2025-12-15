import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { containers, podRecommendations } from "@/lib/mock-data";

export default function ContainerDetail() {
  const { namespace, workloadName, containerName } = useParams();
  
  const container = containers.find((c) => c.name === containerName);

  if (!container) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Container not found</p>
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
                <th>CPU Usage 7d (pmax/p99/p90/p75/p50)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {podRecommendations.map((pod) => (
                <tr key={pod.pod}>
                  <td className="font-mono text-xs">{pod.pod}</td>
                  <td className="font-mono text-sm">{pod.cpuRequest}</td>
                  <td className="font-mono text-sm text-primary">{pod.cpuRecRequest}</td>
                  <td className="font-mono text-sm">{pod.memRequest}</td>
                  <td className="font-mono text-sm text-primary">{pod.memRecRequest}</td>
                  <td className="text-xs text-muted-foreground">
                    {pod.usageP99} / {pod.usageP99} / {pod.usageP99} / {pod.usageP50} / {pod.usageP50}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" className="h-7 px-2" title="View in Shared Chart">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
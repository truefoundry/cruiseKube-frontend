import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  ChevronRight, 
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  PauseCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { podRecommendations, recommendationHistory } from "@/lib/mock-data";

export default function ContainerDetail() {
  const { namespace, workloadName, containerName } = useParams();

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case "applied": return <CheckCircle className="h-4 w-4 text-success" />;
      case "ignored": return <XCircle className="h-4 w-4 text-destructive" />;
      case "snoozed": return <PauseCircle className="h-4 w-4 text-warning" />;
      default: return null;
    }
  };

  const getDecisionStyle = (decision: string) => {
    switch (decision) {
      case "applied": return "text-success";
      case "ignored": return "text-destructive";
      case "snoozed": return "text-warning";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/workloads" className="hover:text-foreground transition-colors">
          Workloads
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to={`/workloads/${namespace}/${workloadName}`} className="hover:text-foreground transition-colors">
          <span className="font-mono">{workloadName}</span>
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
          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-sm text-muted-foreground">{namespace}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">{workloadName}</span>
          </div>
        </div>
      </div>

      {/* Per-Pod Recommendations */}
      <div className="metric-card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Per-Pod Recommendations
          </h3>
          <Link to="/performance">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              View in Charts
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pod</th>
                <th>CPU Req/Limit</th>
                <th>CPU Rec Req/Limit</th>
                <th>Mem Req/Limit</th>
                <th>Mem Rec Req/Limit</th>
                <th>Usage P99</th>
                <th>Usage P50</th>
              </tr>
            </thead>
            <tbody>
              {podRecommendations.map((pod) => (
                <tr key={pod.pod}>
                  <td className="font-mono text-xs">{pod.pod}</td>
                  <td className="font-mono text-sm">
                    <span>{pod.cpuRequest}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{pod.cpuLimit}</span>
                  </td>
                  <td className="font-mono text-sm text-primary">
                    <span>{pod.cpuRecRequest}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{pod.cpuRecLimit}</span>
                  </td>
                  <td className="font-mono text-sm">
                    <span>{pod.memRequest}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{pod.memLimit}</span>
                  </td>
                  <td className="font-mono text-sm text-primary">
                    <span>{pod.memRecRequest}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{pod.memRecLimit}</span>
                  </td>
                  <td className="font-mono text-sm text-warning">{pod.usageP99}</td>
                  <td className="font-mono text-sm text-muted-foreground">{pod.usageP50}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History */}
      <div className="metric-card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recommendation History
          </h3>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>CPU Change</th>
                <th>Memory Change</th>
                <th>Decision</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {recommendationHistory.map((event, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs text-muted-foreground">{event.timestamp}</td>
                  <td className="font-mono text-sm">
                    <span className="text-muted-foreground">{event.oldCpu}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className="text-primary">{event.newCpu}</span>
                  </td>
                  <td className="font-mono text-sm">
                    <span className="text-muted-foreground">{event.oldMem}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className="text-primary">{event.newMem}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {getDecisionIcon(event.decision)}
                      <span className={`text-sm capitalize ${getDecisionStyle(event.decision)}`}>
                        {event.decision}
                      </span>
                    </div>
                  </td>
                  <td className="text-sm text-muted-foreground">{event.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

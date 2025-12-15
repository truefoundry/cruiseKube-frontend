import { 
  Gauge, 
  Layers, 
  DollarSign, 
  AlertTriangle,
  Cpu,
  HardDrive,
  ExternalLink
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { overviewMetrics, wastefulWorkloads } from "@/lib/mock-data";
import { Link } from "react-router-dom";

export default function Overview() {
  const getWasteStatus = (percent: number) => {
    if (percent >= 50) return "destructive";
    if (percent >= 30) return "warning";
    return "success";
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">Cluster optimization at a glance</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span>Last sync: 2 min ago</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Optimization Score"
          value={`${overviewMetrics.optimizationScore}%`}
          subtitle="How optimized is this cluster"
          icon={Gauge}
          variant="success"
        />
        <MetricCard
          title="Coverage"
          value={`${overviewMetrics.coverage}%`}
          subtitle="Optimized / Total workloads"
          icon={Layers}
          variant="default"
        />
        <MetricCard
          title="Reliability Issues"
          value={overviewMetrics.reliabilityIssues}
          subtitle="Workloads at risk"
          icon={AlertTriangle}
          variant={overviewMetrics.reliabilityIssues > 10 ? "warning" : "default"}
        />
        <MetricCard
          title="Total Saved / Hour"
          value={`$${overviewMetrics.totalSavedPerHour.toLocaleString()}`}
          subtitle="Per hour savings"
          icon={DollarSign}
          variant="success"
        />
      </div>

      {/* Savings Summary */}
      <div className="metric-card">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Potential vs Realized Savings / Hour
        </h3>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">CPU Cores</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-foreground">
                  {overviewMetrics.realizedSavings.cpu}
                </span>
                <span className="text-muted-foreground text-sm"> / </span>
                <span className="font-mono text-sm text-muted-foreground">
                  {overviewMetrics.potentialSavings.cpu}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(overviewMetrics.realizedSavings.cpu / overviewMetrics.potentialSavings.cpu) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Memory (GB)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-foreground">
                  {overviewMetrics.realizedSavings.memory}
                </span>
                <span className="text-muted-foreground text-sm"> / </span>
                <span className="font-mono text-sm text-muted-foreground">
                  {overviewMetrics.potentialSavings.memory}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(overviewMetrics.realizedSavings.memory / overviewMetrics.potentialSavings.memory) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Cost ($)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-foreground">
                  ${overviewMetrics.realizedSavings.dollars}
                </span>
                <span className="text-muted-foreground text-sm"> / </span>
                <span className="font-mono text-sm text-muted-foreground">
                  ${overviewMetrics.potentialSavings.dollars}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(overviewMetrics.realizedSavings.dollars / overviewMetrics.potentialSavings.dollars) * 100}%` }}
              />
            </div>
          </div>
        </div>
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
                <th>Waste</th>
                <th>Savings / Hour</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wastefulWorkloads.map((workload, i) => (
                <tr key={i} className="group cursor-pointer">
                  <td className="font-mono text-xs">{workload.namespace}</td>
                  <td className="font-medium">{workload.workload}</td>
                  <td className="text-muted-foreground">{workload.containers}</td>
                  <td>
                    <StatusBadge status={getWasteStatus(workload.wastePercent)}>
                      {workload.wastePercent}%
                    </StatusBadge>
                  </td>
                  <td className="font-mono text-primary">${workload.savingsPerHour}/hr</td>
                  <td>
                    <Link to={`/workloads/${workload.namespace}/${workload.workload}`}>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                        View
                      </Button>
                    </Link>
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
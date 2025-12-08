import { ExternalLink, BarChart3, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Performance() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">Metrics visualization and Grafana dashboards</p>
        </div>
        <Button variant="outline" className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Open in Grafana
        </Button>
      </div>

      {/* Chart Controls */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
        <Select defaultValue="all">
          <SelectTrigger className="w-[140px] bg-background">
            <SelectValue placeholder="Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clusters</SelectItem>
            <SelectItem value="prod-us">prod-us</SelectItem>
            <SelectItem value="prod-eu">prod-eu</SelectItem>
            <SelectItem value="staging">staging</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all">
          <SelectTrigger className="w-[140px] bg-background">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Namespaces</SelectItem>
            <SelectItem value="production">production</SelectItem>
            <SelectItem value="staging">staging</SelectItem>
            <SelectItem value="development">development</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="cpu">
          <SelectTrigger className="w-[140px] bg-background">
            <SelectValue placeholder="Metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cpu">CPU</SelectItem>
            <SelectItem value="memory">Memory</SelectItem>
            <SelectItem value="cpu-pressure">CPU Pressure</SelectItem>
            <SelectItem value="memory-pressure">Memory Pressure</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="p95">
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue placeholder="Percentile" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p50">P50</SelectItem>
            <SelectItem value="p95">P95</SelectItem>
            <SelectItem value="max">Max</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="7d">
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24 hours</SelectItem>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dashboard Embeds */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Controller Metrics
            </h3>
            <Button variant="ghost" size="sm" className="text-xs">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          <div className="h-[300px] flex items-center justify-center rounded-lg bg-muted/30 border border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Grafana Dashboard Embed</p>
              <p className="text-xs mt-1">Controller performance metrics</p>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Webhook Latency
            </h3>
            <Button variant="ghost" size="sm" className="text-xs">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          <div className="h-[300px] flex items-center justify-center rounded-lg bg-muted/30 border border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Grafana Dashboard Embed</p>
              <p className="text-xs mt-1">Webhook response times</p>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Queue Depth
            </h3>
            <Button variant="ghost" size="sm" className="text-xs">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          <div className="h-[300px] flex items-center justify-center rounded-lg bg-muted/30 border border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Grafana Dashboard Embed</p>
              <p className="text-xs mt-1">Recommendation queue metrics</p>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Resource Utilization
            </h3>
            <Button variant="ghost" size="sm" className="text-xs">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          <div className="h-[300px] flex items-center justify-center rounded-lg bg-muted/30 border border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Grafana Dashboard Embed</p>
              <p className="text-xs mt-1">CPU and memory utilization</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active Grafana Alerts
          </h3>
          <span className="status-badge status-badge-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            3 Active
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">High recommendation queue depth</p>
              <p className="text-xs text-muted-foreground mt-0.5">Queue depth exceeds 1000 items for &gt;5 minutes</p>
            </div>
            <span className="ml-auto text-xs text-muted-foreground shrink-0">5m ago</span>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Webhook latency elevated</p>
              <p className="text-xs text-muted-foreground mt-0.5">P95 latency &gt;500ms on prod-us cluster</p>
            </div>
            <span className="ml-auto text-xs text-muted-foreground shrink-0">12m ago</span>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Prometheus scrape failures</p>
              <p className="text-xs text-muted-foreground mt-0.5">Unable to scrape metrics from node-3</p>
            </div>
            <span className="ml-auto text-xs text-muted-foreground shrink-0">28m ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}

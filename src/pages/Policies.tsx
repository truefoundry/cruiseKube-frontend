import { useState } from "react";
import { 
  Power, 
  Database,
  CheckCircle,
  XCircle,
  Settings,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workloads } from "@/lib/mock-data";
import { toast } from "@/hooks/use-toast";

export default function Policies() {
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [prometheusUrl, setPrometheusUrl] = useState("http://prometheus.monitoring:9090");
  const [connectionStatus, setConnectionStatus] = useState<"ok" | "error" | null>("ok");

  const testConnection = () => {
    toast({
      title: "Connection successful",
      description: "Successfully connected to Prometheus",
    });
    setConnectionStatus("ok");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Policies & Configuration</h1>
        <p className="text-sm text-muted-foreground">Configure autopilot behavior and workload settings</p>
      </div>

      {/* Global Settings */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Power className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Global Autopilot</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enable automatic optimization
                </p>
              </div>
            </div>
            <Switch
              checked={globalEnabled}
              onCheckedChange={setGlobalEnabled}
            />
          </div>
        </div>

        <div className="metric-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Global Defaults
          </h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mode:</span>
              <Select defaultValue="enabled">
                <SelectTrigger className="w-[140px] bg-muted/50 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="recommend-only">Recommend Only</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <Select defaultValue="medium">
                <SelectTrigger className="w-[140px] bg-muted/50 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Autopilot Settings Table - Unified */}
      <div className="metric-card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workload Settings
          </h3>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add Workload
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Workload</th>
                <th>Namespace</th>
                <th>Mode</th>
                <th>Priority</th>
                <th>Min CPU</th>
                <th>Max CPU</th>
                <th>Min Mem</th>
                <th>Max Mem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workloads.slice(0, 8).map((workload) => (
                <tr key={workload.id}>
                  <td className="font-medium">{workload.workload}</td>
                  <td className="font-mono text-xs text-muted-foreground">{workload.namespace}</td>
                  <td>
                    <Select defaultValue={workload.mode}>
                      <SelectTrigger className="w-[130px] bg-muted/50 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">Enabled</SelectItem>
                        <SelectItem value="recommend-only">Recommend Only</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <Select defaultValue={workload.priority}>
                      <SelectTrigger className="w-[130px] bg-muted/50 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="non-evictable">Non-evictable</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <Input 
                      defaultValue="50m" 
                      className="w-16 bg-muted/50 font-mono text-xs h-8" 
                    />
                  </td>
                  <td>
                    <Input 
                      defaultValue="2000m" 
                      className="w-16 bg-muted/50 font-mono text-xs h-8" 
                    />
                  </td>
                  <td>
                    <Input 
                      defaultValue="128Mi" 
                      className="w-16 bg-muted/50 font-mono text-xs h-8" 
                    />
                  </td>
                  <td>
                    <Input 
                      defaultValue="4Gi" 
                      className="w-16 bg-muted/50 font-mono text-xs h-8" 
                    />
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prometheus Config */}
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Prometheus Configuration
          </h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Prometheus URL</label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                value={prometheusUrl}
                onChange={(e) => setPrometheusUrl(e.target.value)}
                className="bg-muted/50 font-mono text-sm flex-1"
                placeholder="http://prometheus:9090"
              />
              <Button onClick={testConnection}>
                Test Connection
              </Button>
            </div>
          </div>

          {connectionStatus && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              connectionStatus === "ok" 
                ? "bg-success/10 border border-success/20" 
                : "bg-destructive/10 border border-destructive/20"
            }`}>
              {connectionStatus === "ok" ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">Connected successfully</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">Connection failed</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
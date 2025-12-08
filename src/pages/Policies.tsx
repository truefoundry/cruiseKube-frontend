import { useState } from "react";
import { 
  Power, 
  Shield, 
  Cpu, 
  Database,
  CheckCircle,
  XCircle,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    // Simulate connection test
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

      <Tabs defaultValue="mode" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="mode" className="gap-2">
            <Power className="h-4 w-4" />
            Autopilot Mode
          </TabsTrigger>
          <TabsTrigger value="priority" className="gap-2">
            <Shield className="h-4 w-4" />
            Priority & Eviction
          </TabsTrigger>
          <TabsTrigger value="caps" className="gap-2">
            <Cpu className="h-4 w-4" />
            CPU/Memory Caps
          </TabsTrigger>
          <TabsTrigger value="prometheus" className="gap-2">
            <Database className="h-4 w-4" />
            Prometheus
          </TabsTrigger>
        </TabsList>

        {/* Autopilot Mode */}
        <TabsContent value="mode" className="space-y-6">
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Global Autopilot</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable or disable automatic optimization across all workloads
                </p>
              </div>
              <Switch
                checked={globalEnabled}
                onCheckedChange={setGlobalEnabled}
              />
            </div>
          </div>

          <div className="metric-card overflow-hidden">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Per-Workload Mode
            </h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Workload</th>
                    <th>Namespace</th>
                    <th>Mode</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {workloads.slice(0, 6).map((workload) => (
                    <tr key={workload.id}>
                      <td className="font-medium">{workload.workload}</td>
                      <td className="font-mono text-xs text-muted-foreground">{workload.namespace}</td>
                      <td>
                        <Select defaultValue={workload.mode}>
                          <SelectTrigger className="w-[160px] bg-muted/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enabled">Enabled</SelectItem>
                            <SelectItem value="recommend-only">Recommend Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Priority & Eviction */}
        <TabsContent value="priority" className="space-y-6">
          <div className="metric-card overflow-hidden">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Workload Priority
            </h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Workload</th>
                    <th>Namespace</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {workloads.slice(0, 6).map((workload) => (
                    <tr key={workload.id}>
                      <td className="font-medium">{workload.workload}</td>
                      <td className="font-mono text-xs text-muted-foreground">{workload.namespace}</td>
                      <td>
                        <Select defaultValue={workload.priority}>
                          <SelectTrigger className="w-[160px] bg-muted/50">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* CPU/Memory Caps */}
        <TabsContent value="caps" className="space-y-6">
          <div className="metric-card overflow-hidden">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Resource Caps
            </h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Workload</th>
                    <th>Min CPU</th>
                    <th>Max CPU</th>
                    <th>Min Memory</th>
                    <th>Max Memory</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {workloads.slice(0, 6).map((workload) => (
                    <tr key={workload.id}>
                      <td className="font-medium">{workload.workload}</td>
                      <td>
                        <Input 
                          defaultValue="50m" 
                          className="w-20 bg-muted/50 font-mono text-xs h-8" 
                        />
                      </td>
                      <td>
                        <Input 
                          defaultValue="2000m" 
                          className="w-20 bg-muted/50 font-mono text-xs h-8" 
                        />
                      </td>
                      <td>
                        <Input 
                          defaultValue="128Mi" 
                          className="w-20 bg-muted/50 font-mono text-xs h-8" 
                        />
                      </td>
                      <td>
                        <Input 
                          defaultValue="4Gi" 
                          className="w-20 bg-muted/50 font-mono text-xs h-8" 
                        />
                      </td>
                      <td>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Prometheus Config */}
        <TabsContent value="prometheus" className="space-y-6">
          <div className="metric-card">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Prometheus Configuration
            </h3>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

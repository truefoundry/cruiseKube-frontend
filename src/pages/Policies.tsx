import { 
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Info,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, WorkloadOverrideInfo, Overrides, type PrometheusConfig } from "@/lib/api";
import { mapEvictionRankingToPriority, mapPriorityToEvictionRanking } from "@/lib/transformers";
import { useCluster } from "@/contexts/ClusterContext";
import { useConfig } from "@/contexts/ConfigContext";
import { toast } from "@/hooks/use-toast";
import { asArray } from "@/lib/utils";
import { getResourcePricing, setResourcePricing, DEFAULT_CPU, DEFAULT_MEMORY } from "@/lib/pricing";

export default function Policies() {
  const { selectedClusterId } = useCluster();
  const { config: prometheusConfig, isLoading: prometheusConfigLoading, refetch: refetchPrometheusConfig } = useConfig();
  const queryClient = useQueryClient();
  const [updatingWorkloads, setUpdatingWorkloads] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [cpuPrice, setCpuPrice] = useState<string>(() => String(getResourcePricing().cpuPerCorePerHour));
  const [memoryPrice, setMemoryPrice] = useState<string>(() => String(getResourcePricing().memoryPerGbPerHour));

  const { data: workloads, isLoading: workloadsLoading, error: workloadsError } = useQuery({
    queryKey: ['workloads', selectedClusterId],
    queryFn: () => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.getWorkloads(selectedClusterId);
    },
    enabled: !!selectedClusterId,
  });

  const updateOverrideMutation = useMutation({
    mutationFn: async ({ workloadId, overrides }: { workloadId: string; overrides: Overrides }) => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.updateWorkloadOverrides(selectedClusterId, workloadId, overrides);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workloads', selectedClusterId] });
      toast({
        title: "Success",
        description: "Workload override updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update workload override",
        variant: "destructive",
      });
    },
  });

  const handleModeChange = async (workloadId: string, enabled: boolean) => {
    setUpdatingWorkloads(prev => new Set(prev).add(workloadId));
    try {
      await updateOverrideMutation.mutateAsync({
        workloadId,
        overrides: { enabled },
      });
    } finally {
      setUpdatingWorkloads(prev => {
        const next = new Set(prev);
        next.delete(workloadId);
        return next;
      });
    }
  };

  const handlePriorityChange = async (workloadId: string, priority: 'low' | 'medium' | 'high' | 'non-evictable') => {
    setUpdatingWorkloads(prev => new Set(prev).add(workloadId));
    try {
      const evictionRanking = mapPriorityToEvictionRanking(priority);
      await updateOverrideMutation.mutateAsync({
        workloadId,
        overrides: { eviction_ranking: evictionRanking },
      });
    } finally {
      setUpdatingWorkloads(prev => {
        const next = new Set(prev);
        next.delete(workloadId);
        return next;
      });
    }
  };

  const getWorkloadPriority = (workload: WorkloadOverrideInfo): 'low' | 'medium' | 'high' | 'non-evictable' => {
    return mapEvictionRankingToPriority(workload.eviction_ranking);
  };

  const testConnection = async () => {
    try {
      await refetchPrometheusConfig();
      const data = queryClient.getQueryData<PrometheusConfig>(['config', selectedClusterId]);
      if (data?.connected) {
        toast({
          title: "Connection successful",
          description: "Successfully connected to Prometheus",
        });
      } else {
        toast({
          title: "Connection failed",
          description: data?.error || "Failed to connect to Prometheus",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect to Prometheus",
        variant: "destructive",
      });
    }
  };

  if (!selectedClusterId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please select a cluster to view policies
        </div>
      </div>
    );
  }

  if (workloadsLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workloadsError) {
    return (
      <div className="p-6">
        <div className="text-center text-destructive">
          Failed to load workloads: {workloadsError instanceof Error ? workloadsError.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  const workloadsList = asArray(workloads).filter((w) => {
    const matchesSearch = 
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.namespace.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Policies & Configuration</h1>
        <p className="text-sm text-muted-foreground">Configure CruiseKube behavior and workload settings</p>
      </div>

      <Tabs defaultValue="mode" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="mode">CruiseKube Mode & Priority</TabsTrigger>
          <TabsTrigger value="pricing">Resource Pricing</TabsTrigger>
          <TabsTrigger value="prometheus">Prometheus Config</TabsTrigger>
        </TabsList>

        <TabsContent value="mode" className="space-y-6">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workloads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-border"
            />
          </div>
          <div className="metric-card overflow-hidden">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Per Workload Settings
            </h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Workload</th>
                    <th>Namespace</th>
                    <th>
                      <div className="flex items-center gap-1.5">
                        Mode
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Enables auto-apply of recommendations. When Cruise is enabled, CruiseKube will automatically apply resource recommendations.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-1.5">
                        Priority
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Determines eviction priority during optimization. Higher priority workloads have a lower chance of being evicted when the algorithm needs to optimize resources. This is determined using the mode setting.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {workloadsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted-foreground py-8">
                        No workloads found
                      </td>
                    </tr>
                  ) : (
                    asArray(workloadsList).map((workload) => {
                      const isUpdating = updatingWorkloads.has(workload.workload_id);
                      const currentPriority = getWorkloadPriority(workload);
                      return (
                        <tr key={workload.workload_id}>
                          <td className="font-medium">{workload.name}</td>
                          <td className="font-mono text-xs text-muted-foreground">{workload.namespace}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm ${!workload.enabled ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                Recommend
                              </span>
                              <Switch
                                checked={workload.enabled}
                                onCheckedChange={(checked) => handleModeChange(workload.workload_id, checked)}
                                disabled={isUpdating}
                              />
                              <span className={`text-sm ${workload.enabled ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                Cruise
                              </span>
                            </div>
                          </td>
                          <td>
                            <Select 
                              value={currentPriority}
                              onValueChange={(value) => handlePriorityChange(workload.workload_id, value as 'low' | 'medium' | 'high' | 'non-evictable')}
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="w-[150px] bg-muted/50 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="non-evictable">Non-evictable</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td>
                            {isUpdating && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Resource Pricing Tab */}
        <TabsContent value="pricing" className="space-y-6">
          <div className="metric-card">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Resource Pricing
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Set hourly prices for CPU and Memory used in cost calculations on the Workloads page. Values are stored in your browser only.
            </p>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="text-sm font-medium text-foreground">CPU ($/core/hour)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={cpuPrice}
                  onChange={(e) => setCpuPrice(e.target.value)}
                  className="bg-muted/50 mt-2"
                  placeholder={String(DEFAULT_CPU)}
                />
                <p className="text-xs text-muted-foreground mt-1">Default: ${DEFAULT_CPU}/core/hour</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Memory ($/GB/hour)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={memoryPrice}
                  onChange={(e) => setMemoryPrice(e.target.value)}
                  className="bg-muted/50 mt-2"
                  placeholder={String(DEFAULT_MEMORY)}
                />
                <p className="text-xs text-muted-foreground mt-1">Default: ${DEFAULT_MEMORY}/GB/hour</p>
              </div>
              <Button
                onClick={() => {
                  const cpu = parseFloat(cpuPrice);
                  const mem = parseFloat(memoryPrice);
                  if (Number.isNaN(cpu) || cpu < 0 || Number.isNaN(mem) || mem < 0) {
                    toast({
                      title: "Invalid values",
                      description: "Please enter valid non-negative numbers for CPU and Memory price.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setResourcePricing({ cpuPerCorePerHour: cpu, memoryPerGbPerHour: mem });
                  toast({
                    title: "Saved",
                    description: "Resource pricing has been saved. Cost figures on Workloads will use these values.",
                  });
                }}
              >
                Save to browser storage
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Prometheus Config Tab */}
        <TabsContent value="prometheus" className="space-y-6">
          <div className="metric-card">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Prometheus Configuration
              </h3>
            </div>
            {prometheusConfigLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Prometheus URL</label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      value={prometheusConfig?.url || ""}
                      readOnly
                      className="bg-muted/50 font-mono text-sm flex-1"
                      placeholder="http://prometheus:9090"
                    />
                    <Button onClick={testConnection} disabled={prometheusConfigLoading}>
                      Test Connection
                    </Button>
                  </div>
                </div>

                {prometheusConfig && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    prometheusConfig.connected 
                      ? "bg-success/10 border border-success/20" 
                      : "bg-destructive/10 border border-destructive/20"
                  }`}>
                    {prometheusConfig.connected ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm text-success">Connected successfully</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">
                          {prometheusConfig.error || "Connection failed"}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
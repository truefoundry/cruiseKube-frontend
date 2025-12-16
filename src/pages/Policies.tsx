import { 
  Database,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, WorkloadOverrideInfo, Overrides } from "@/lib/api";
import { mapEvictionRankingToPriority, mapPriorityToEvictionRanking } from "@/lib/transformers";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "@/hooks/use-toast";

export default function Policies() {
  const { selectedClusterId } = useCluster();
  const queryClient = useQueryClient();
  const [updatingWorkloads, setUpdatingWorkloads] = useState<Set<string>>(new Set());

  const { data: workloads, isLoading: workloadsLoading, error: workloadsError } = useQuery({
    queryKey: ['workloads', selectedClusterId],
    queryFn: () => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.getWorkloads(selectedClusterId);
    },
    enabled: !!selectedClusterId,
  });

  const { data: prometheusConfig, isLoading: prometheusConfigLoading, refetch: refetchPrometheusConfig } = useQuery({
    queryKey: ['prometheus-config', selectedClusterId],
    queryFn: () => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.getPrometheusConfig(selectedClusterId);
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

  const handleModeChange = async (workloadId: string, mode: 'enabled' | 'recommend-only') => {
    setUpdatingWorkloads(prev => new Set(prev).add(workloadId));
    try {
      const enabled = mode === 'enabled';
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

  const getWorkloadMode = (workload: WorkloadOverrideInfo): 'enabled' | 'recommend-only' => {
    if (workload.enabled) return 'enabled';
    return 'recommend-only';
  };

  const getWorkloadPriority = (workload: WorkloadOverrideInfo): 'low' | 'medium' | 'high' | 'non-evictable' => {
    return mapEvictionRankingToPriority(workload.eviction_ranking);
  };

  const testConnection = async () => {
    try {
      const result = await refetchPrometheusConfig();
      if (result.data?.connected) {
        toast({
          title: "Connection successful",
          description: "Successfully connected to Prometheus",
        });
      } else {
        toast({
          title: "Connection failed",
          description: result.data?.error || "Failed to connect to Prometheus",
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

  const workloadsList = workloads || [];

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
          <TabsTrigger value="prometheus">Prometheus Config</TabsTrigger>
        </TabsList>

        <TabsContent value="mode" className="space-y-6">
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
                    <th>Mode</th>
                    <th>Priority</th>
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
                    workloadsList.map((workload) => {
                      const isUpdating = updatingWorkloads.has(workload.workload_id);
                      const currentMode = getWorkloadMode(workload);
                      const currentPriority = getWorkloadPriority(workload);
                      return (
                        <tr key={workload.workload_id}>
                          <td className="font-medium">{workload.name}</td>
                          <td className="font-mono text-xs text-muted-foreground">{workload.namespace}</td>
                          <td>
                            <Select 
                              value={currentMode}
                              onValueChange={(value) => handleModeChange(workload.workload_id, value as 'enabled' | 'recommend-only')}
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="w-[150px] bg-muted/50 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="enabled">Enabled</SelectItem>
                                <SelectItem value="recommend-only">Recommend Only</SelectItem>
                              </SelectContent>
                            </Select>
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
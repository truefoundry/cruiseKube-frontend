import {
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingTour } from "@/components/onboarding/useOnboardingTour";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type PrometheusConfig, type ClusterSettings } from "@/lib/api";
import { useCluster } from "@/contexts/ClusterContext";
import { useConfig } from "@/contexts/ConfigContext";
import { toast } from "@/hooks/use-toast";
import { setResourcePricing } from "@/lib/pricing";

const DEFAULT_CPU = 0.0145;
const DEFAULT_MEMORY = 0.00724;

export default function Policies() {
  const { startTour, isMobile } = useOnboardingTour();
  const { selectedClusterId } = useCluster();
  const { config: prometheusConfig, isLoading: prometheusConfigLoading, refetch: refetchPrometheusConfig } = useConfig();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery<ClusterSettings>({
    queryKey: ['settings', selectedClusterId],
    queryFn: () => apiClient.getSettings(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const [cpuPrice, setCpuPrice] = useState<string>('');
  const [memoryPrice, setMemoryPrice] = useState<string>('');

  useEffect(() => {
    if (settings) {
      setCpuPrice(String(settings.cpuPricePerCorePerHour));
      setMemoryPrice(String(settings.memoryPricePerGBPerHour));
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: ClusterSettings) =>
      apiClient.updateSettings(selectedClusterId!, newSettings),
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings', selectedClusterId], saved);
      // Keep client-side cost calculations in sync (pricing.ts divides by 2 internally)
      setResourcePricing({
        cpuPerCorePerHour: saved.cpuPricePerCorePerHour * 2,
        memoryPerGbPerHour: saved.memoryPricePerGBPerHour * 2,
      });
      queryClient.invalidateQueries({ queryKey: ['workloads-summary', selectedClusterId] });
      toast({
        title: "Saved",
        description: "Resource pricing has been updated. Cost figures will reflect the new values.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
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
    updateSettingsMutation.mutate({ cpuPricePerCorePerHour: cpu, memoryPricePerGBPerHour: mem });
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Policies &amp; Configuration
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure CruiseKube behavior and workload settings
          </p>
        </div>
        {!isMobile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => startTour()}
            className="shrink-0 gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Retake tour
          </Button>
        )}
      </div>

      <Tabs defaultValue="pricing" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pricing">Resource Pricing</TabsTrigger>
          <TabsTrigger value="prometheus">Prometheus Config</TabsTrigger>
        </TabsList>

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
              Set hourly prices for CPU and Memory used in cost calculations on the Workloads page. Values are saved to the cluster settings.
            </p>
            {settingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="text-sm font-medium text-foreground">CPU ($/core/hour)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
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
                    step="0.0001"
                    value={memoryPrice}
                    onChange={(e) => setMemoryPrice(e.target.value)}
                    className="bg-muted/50 mt-2"
                    placeholder={String(DEFAULT_MEMORY)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Default: ${DEFAULT_MEMORY}/GB/hour</p>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            )}
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

                {prometheusConfig?.version ? (
                  <div>
                    <label className="text-sm font-medium text-foreground">Version</label>
                    <p className="mt-2 text-sm font-mono text-muted-foreground break-all">{prometheusConfig.version}</p>
                  </div>
                ) : null}

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
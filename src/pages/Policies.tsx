import {
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  Settings2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { SectionHeader } from "@/components/layout/SectionHeader";
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
  const { selectedClusterId } = useCluster();
  const { config: prometheusConfig, isLoading: prometheusConfigLoading, refetch: refetchPrometheusConfig } = useConfig();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery<ClusterSettings>({
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
      <PageShell className="animate-fade-in">
        <PageHeader
          icon={<Settings2 className="h-5 w-5" />}
          title="Settings"
          description="Configure CruiseKube behavior and workload settings."
        />
        <EmptyState
          title="Select a cluster"
          description="Please select a cluster to view and edit policies."
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="animate-fade-in">
      <PageHeader
        icon={<Settings2 className="h-5 w-5" />}
        title="Settings"
        description="Configure cost calculations, observability connections, and workload settings for the selected cluster."
      />

      <Tabs defaultValue="pricing" className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-full justify-start sm:w-auto">
            <TabsTrigger value="pricing">Resource Pricing</TabsTrigger>
            <TabsTrigger value="prometheus">Prometheus Config</TabsTrigger>
          </TabsList>
        </div>

        {/* Resource Pricing Tab */}
        <TabsContent value="pricing" className="space-y-6">
          <Panel className="space-y-5">
            <SectionHeader
              title="Resource Pricing"
              description="Set hourly prices used by workload cost and savings calculations. Values are saved to cluster settings."
              helpText="CruiseKube uses these prices to estimate workload spend and savings across the Workloads and Overview pages."
              action={
                <div className="flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  USD hourly rates
                </div>
              }
            />

            {settingsLoading ? (
              <LoadingState
                className="min-h-[240px]"
                title="Loading pricing"
                description="Fetching the saved CPU and memory rates for this cluster."
              />
            ) : settingsError ? (
              <ErrorState
                className="min-h-[240px]"
                title="Could not load pricing"
                description={settingsError instanceof Error ? settingsError.message : "Failed to load resource pricing."}
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(260px,1fr)]">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground" htmlFor="cpu-price">
                      CPU ($/core/hour)
                    </label>
                    <Input
                      id="cpu-price"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={cpuPrice}
                      onChange={(e) => setCpuPrice(e.target.value)}
                      className="mt-2"
                      placeholder={String(DEFAULT_CPU)}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Default: ${DEFAULT_CPU}/core/hour
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground" htmlFor="memory-price">
                      Memory ($/GB/hour)
                    </label>
                    <Input
                      id="memory-price"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={memoryPrice}
                      onChange={(e) => setMemoryPrice(e.target.value)}
                      className="mt-2"
                      placeholder={String(DEFAULT_MEMORY)}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Default: ${DEFAULT_MEMORY}/GB/hour
                    </p>
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={updateSettingsMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save pricing"
                    )}
                  </Button>
                </div>

                <Alert variant="info" className="h-fit">
                  <DollarSign className="h-4 w-4" />
                  <AlertTitle>Pricing impacts estimates</AlertTitle>
                  <AlertDescription>
                    Updated rates are applied to cost calculations after saving and are reflected on subsequent workload summaries.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* Prometheus Config Tab */}
        <TabsContent value="prometheus" className="space-y-6">
          <Panel className="space-y-5">
            <SectionHeader
              title="Prometheus Configuration"
              description="Review the Prometheus endpoint used for metrics ingestion and verify its connection status."
              helpText="This configuration is read from the active cluster context and is used to power utilization, charts, and recommendations."
              action={
                prometheusConfig ? (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                    prometheusConfig.connected
                      ? "border-success/25 bg-success/10 text-success"
                      : "border-destructive/25 bg-destructive/10 text-destructive"
                  }`}>
                    {prometheusConfig.connected ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {prometheusConfig.connected ? "Connected" : "Disconnected"}
                  </span>
                ) : null
              }
            />

            {prometheusConfigLoading ? (
              <LoadingState
                className="min-h-[240px]"
                title="Loading Prometheus configuration"
                description="Checking the endpoint and current connection state."
              />
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="prometheus-url">
                    Prometheus URL
                  </label>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                      id="prometheus-url"
                      value={prometheusConfig?.url || ""}
                      readOnly
                      className="font-mono text-sm sm:flex-1"
                      placeholder="http://prometheus:9090"
                    />
                    <Button onClick={testConnection} disabled={prometheusConfigLoading} className="sm:w-auto">
                      Test Connection
                    </Button>
                  </div>
                </div>

                {prometheusConfig?.version ? (
                  <div className="rounded-lg border border-border bg-surface-subtle/60 p-4">
                    <label className="text-sm font-medium text-foreground">Version</label>
                    <p className="mt-2 break-all font-mono text-sm text-muted-foreground">{prometheusConfig.version}</p>
                  </div>
                ) : null}

                {prometheusConfig ? (
                  <Alert variant={prometheusConfig.connected ? "success" : "destructive"}>
                    {prometheusConfig.connected ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {prometheusConfig.connected ? "Connected successfully" : "Connection failed"}
                    </AlertTitle>
                    <AlertDescription>
                      {prometheusConfig.connected
                        ? "CruiseKube can read metrics from the configured Prometheus endpoint."
                        : prometheusConfig.error || "CruiseKube could not connect to the configured Prometheus endpoint."}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <EmptyState
                    className="min-h-[220px]"
                    icon={Database}
                    title="No Prometheus configuration"
                    description="No Prometheus endpoint is available for the selected cluster."
                  />
                )}
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

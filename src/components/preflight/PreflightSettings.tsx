import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCluster } from "@/contexts/ClusterContext";
import { usePreflight } from "@/hooks/usePreflight";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PreflightReportBody } from "@/components/preflight/PreflightStatusPage";
import { DownloadReportButton } from "@/components/preflight/DownloadReportButton";

/**
 * Settings tab that lets the user re-run the backend preflight checks on demand
 * and download the resulting report to share with the CruiseKube team.
 */
export function PreflightSettings() {
  const { selectedClusterId } = useCluster();
  const { data, isLoading, isError, error, refetch, isFetching } =
    usePreflight(selectedClusterId);

  if (!selectedClusterId) {
    return (
      <EmptyState
        className="min-h-[240px]"
        icon={ShieldCheck}
        title="Select a cluster"
        description="Please select a cluster to run its setup checks."
      />
    );
  }

  const generatedAt = data?.generated_at ? new Date(data.generated_at) : null;
  const generatedLabel =
    generatedAt && !Number.isNaN(generatedAt.getTime())
      ? generatedAt.toLocaleString()
      : null;

  return (
    <Panel className="space-y-5">
      <SectionHeader
        title="Setup checks"
        description="Re-run CruiseKube's preflight checks (Prometheus connectivity, Kubernetes versions, and required metrics) for the selected cluster, and download the full report to share with the team."
        action={
          data ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                data.healthy
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              {data.healthy ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {data.healthy ? "Healthy" : "Setup incomplete"}
            </span>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => refetch()} disabled={isFetching} className="gap-2">
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isFetching ? "Running…" : "Run checks"}
        </Button>
        {data ? <DownloadReportButton data={data} /> : null}
        {data?.versions?.cruisekube_version ? (
          <span className="text-xs text-muted-foreground">
            CruiseKube{" "}
            <code className="font-mono text-foreground">
              {data.versions.cruisekube_version}
            </code>
          </span>
        ) : null}
        {generatedLabel ? (
          <span className="text-xs text-muted-foreground">
            Last run {generatedLabel}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <LoadingState
          className="min-h-[220px]"
          title="Running setup checks…"
          description="Verifying Prometheus connectivity, Kubernetes versions, and required metrics."
        />
      ) : isError || !data ? (
        <ErrorState
          className="min-h-[220px]"
          title="Couldn't run setup checks"
          description={
            error instanceof Error
              ? error.message
              : "The preflight request failed. Check that the cluster is reachable and try again."
          }
        />
      ) : (
        <div className="space-y-6">
          <Alert variant={data.healthy ? "success" : "destructive"}>
            {data.healthy ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>
              {data.healthy
                ? "All checks passed"
                : `${data.summary.failed} of ${data.summary.total_checks} checks failed`}
            </AlertTitle>
            <AlertDescription>
              {data.healthy
                ? `${data.summary.passed} of ${data.summary.total_checks} checks passed. This cluster is ready and the dashboard will load normally.`
                : "Resolve the items below, then re-run the checks. Download the report to share the full details with the CruiseKube team."}
            </AlertDescription>
          </Alert>
          <PreflightReportBody data={data} />
        </div>
      )}
    </Panel>
  );
}

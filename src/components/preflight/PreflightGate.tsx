import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useCluster } from "@/contexts/ClusterContext";
import { usePreflight } from "@/hooks/usePreflight";
import { PageShell } from "@/components/layout/PageShell";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { PreflightStatusPage } from "./PreflightStatusPage";

/**
 * Gates its children (the Overview page) behind the backend preflight check.
 *
 * - No cluster selected → render children (Overview shows its own empty state).
 * - Request in flight → "Running setup checks…" loading state.
 * - 400 / 404 / network / 5xx → error state with a Retry button (never falls
 *   through to Overview).
 * - 200 + `healthy: false` → the setup/status page.
 * - 200 + `healthy: true` → render children (Overview).
 *
 * Re-runs on cluster switch (query key) and on manual retry.
 */
export function PreflightGate({ children }: { children: ReactNode }) {
  const { selectedClusterId } = useCluster();
  const { data, isLoading, isError, error, refetch, isFetching } =
    usePreflight(selectedClusterId);

  // Without a cluster there is nothing to check — let Overview render its own
  // "Select a cluster" state.
  if (!selectedClusterId) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <PageShell className="animate-fade-in">
        <LoadingState
          icon={Loader2}
          title="Running setup checks…"
          description="Verifying Prometheus connectivity, Kubernetes versions, and required metrics for this cluster."
        />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell className="animate-fade-in">
        <ErrorState
          icon={AlertTriangle}
          title="Couldn't run setup checks"
          description={
            error instanceof Error
              ? error.message
              : "The preflight request failed. Check that the cluster is reachable and try again."
          }
          action={{
            label: isFetching ? "Retrying…" : "Retry",
            onClick: () => refetch(),
            disabled: isFetching,
          }}
        />
      </PageShell>
    );
  }

  if (!data.healthy) {
    return (
      <PreflightStatusPage
        data={data}
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return <>{children}</>;
}

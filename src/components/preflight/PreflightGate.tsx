import type { ReactNode } from "react";
import { useCluster } from "@/contexts/ClusterContext";
import { usePreflight } from "@/hooks/usePreflight";
import { PreflightStatusPage } from "./PreflightStatusPage";

/**
 * Renders the Overview, with the preflight check running in the BACKGROUND.
 *
 * Preflight must never block the dashboard: while the (cached, async) check is
 * loading — or if it errors — the Overview renders as normal. The setup status
 * page is only brought forward once we have a definitive `healthy: false`
 * result; a subsequent healthy result (e.g. after "Re-run checks") returns the
 * user to the Overview.
 *
 * The check is cached for 30 minutes and refreshed in the background; see
 * `usePreflight`.
 */
export function PreflightGate({ children }: { children: ReactNode }) {
  const { selectedClusterId } = useCluster();
  const { data, refetch, isFetching } = usePreflight(selectedClusterId);

  if (selectedClusterId && data && !data.healthy) {
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

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type PreflightResponse } from "@/lib/api";

/**
 * Runs the backend preflight/health checks for a cluster.
 *
 * A `200` with `healthy: false` is a normal, resolved result (setup incomplete)
 * — NOT an error. Only `400`/`404`/network/`5xx` surface as `isError` (the api
 * client throws for those). The query key includes `clusterID`, so switching
 * clusters re-runs the checks automatically; call `refetch()` for manual retry.
 */
export function usePreflight(clusterID: string | null): UseQueryResult<PreflightResponse, Error> {
  return useQuery({
    queryKey: ["preflight", clusterID],
    queryFn: () => apiClient.getPreflight(clusterID!),
    enabled: !!clusterID,
    // The result reflects live cluster setup; keep it fresh but avoid refetch storms.
    staleTime: 30_000,
    retry: 1,
  });
}

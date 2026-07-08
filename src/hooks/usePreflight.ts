import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type PreflightResponse } from "@/lib/api";

/** Preflight results are cached for 30 minutes, then re-run in the background. */
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_PREFIX = "cruisekube-preflight-cache:";

interface CachedPreflight {
  data: PreflightResponse;
  /** epoch ms the checks were run. */
  cachedAt: number;
}

function cacheKey(clusterID: string): string {
  return `${CACHE_PREFIX}${clusterID}`;
}

/** Reads a cached entry for a cluster (regardless of age). */
function readCache(clusterID: string | null): CachedPreflight | null {
  if (!clusterID) return null;
  try {
    const raw = localStorage.getItem(cacheKey(clusterID));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPreflight;
    if (!parsed || typeof parsed.cachedAt !== "number" || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Reads a cached entry only if it is still within the 30-minute TTL. */
function readFreshCache(clusterID: string | null): CachedPreflight | null {
  const cached = readCache(clusterID);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt >= CACHE_TTL_MS) return null;
  return cached;
}

function writeCache(clusterID: string, data: PreflightResponse): void {
  try {
    const entry: CachedPreflight = { data, cachedAt: Date.now() };
    localStorage.setItem(cacheKey(clusterID), JSON.stringify(entry));
  } catch {
    // Ignore quota / serialization errors — caching is best-effort.
  }
}

/**
 * Runs the backend preflight/health checks for a cluster, cached for 30 minutes
 * and refreshed in the background.
 *
 * The result is persisted to localStorage (per cluster) and reused for 30
 * minutes, so opening the dashboard or the Settings tab does NOT re-run the
 * checks while the cache is fresh. When the cache is missing or older than 30
 * minutes the check runs asynchronously in the background (it must never block
 * the Overview — see PreflightGate), and it also re-runs on a 30-minute interval
 * while mounted. Calling `refetch()` (the "Re-run / Run checks" button) always
 * hits the API immediately and refreshes the cache.
 *
 * A `200` with `healthy: false` is a normal, resolved result (setup incomplete)
 * — NOT an error. Only `404`/network/`5xx` surface as `isError` (the api client
 * throws for those). The query key includes `clusterID`, so switching clusters
 * uses that cluster's own cached result.
 */
export function usePreflight(clusterID: string | null): UseQueryResult<PreflightResponse, Error> {
  return useQuery({
    queryKey: ["preflight", clusterID],
    queryFn: async () => {
      const result = await apiClient.getPreflight(clusterID!);
      writeCache(clusterID!, result);
      return result;
    },
    enabled: !!clusterID,
    // Fresh cache (< 30 min) is never considered stale, so it won't refetch on
    // mount / cluster open / window focus; after 30 min it refreshes in the
    // background (kept off the critical path by the non-blocking gate).
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
    refetchInterval: CACHE_TTL_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Seed from the persisted cache so reloads reuse it. When absent/expired this
    // returns undefined, which lets the query fetch (in the background) on mount.
    initialData: () => readFreshCache(clusterID)?.data,
    initialDataUpdatedAt: () => readFreshCache(clusterID)?.cachedAt,
    retry: 1,
  });
}

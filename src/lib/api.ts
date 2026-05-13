import { getBasicAuthorizationHeader } from '@/lib/auth-session';

const API_BASE_URL = '/api';

export interface ApiError {
  error: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** Successful login: `token` is Base64(username:password) for `Authorization: Basic <token>`. */
export interface LoginResponse {
  token: string;
  token_type?: 'Basic';
}

export interface AuthInfoResponse {
  auth_enabled: boolean;
  message?: string;
}

let unauthorizedHandler: (() => void) | null = null;

/** Register callback for 401 on protected routes (e.g. clear session and redirect to login). */
export function setApiUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function isAuthSkippedRequest(endpoint: string, init?: RequestInit): boolean {
  const path = endpoint.split('?')[0] ?? '';
  const method = (init?.method ?? 'GET').toUpperCase();
  if (path === '/auth/login' && method === 'POST') return true;
  if (path === '/' && method === 'GET') return true;
  return false;
}

export interface Cluster {
  id: string;
  name: string;
  stats_available: boolean;
}

export interface ClustersResponse {
  clusters: Cluster[];
  count: number;
  cluster_mode: string;
}

/** One disruption window: cron expressions in UTC. */
export interface DisruptionWindow {
  start_cron: string;
  end_cron: string;
}

/** Effective overrides returned in the workload list (always present per workload). */
export interface WorkloadOverridesEffective {
  eviction_ranking: number;
  enabled: boolean;
  disruption_windows?: DisruptionWindow[];
}

export interface WorkloadOverrideInfo {
  workload_id: string;
  name: string;
  namespace: string;
  kind: string;
  overrides: WorkloadOverridesEffective;
}

export interface Overrides {
  eviction_ranking?: number;
  enabled?: boolean;
  disruption_windows?: DisruptionWindow[];
}

export interface SimplePrediction {
  weekly_prediction: number;
  hourly_prediction: number;
  current_prediction: number;
  max_value: number;
}

export interface ContainerStats {
  container_name: string;
  container_type: number;
  cpu_stats?: {
    max: number;
    p50: number;
    p75: number;
  };
  psi_adjusted_usage?: {
    max: number;
    p50: number;
    p75: number;
  };
  memory_stats?: {
    max: number;
    p75: number;
    oom_memory?: number;
  };
  cpu_7day?: {
    max: number;
    p50: number;
    p75: number;
    p90: number;
    p99: number;
  };
  memory_7day?: {
    max: number;
  };
  simple_predictions_cpu?: SimplePrediction;
  simple_predictions_memory?: SimplePrediction;
}

/** Known exclusion reason codes from the backend. */
export const EXCLUDED_CODES = {
  GPU_WORKLOAD: "GPU_WORKLOAD",
  MEMORY_HPA: "MEMORY_HPA",
  CPU_HPA: "CPU_HPA",
  INCOMPLETE_STATS: "INCOMPLETE_STATS",
} as const;
export type ExcludedCode = (typeof EXCLUDED_CODES)[keyof typeof EXCLUDED_CODES];

/** Human-readable labels for excluded codes. Unknown codes are shown as-is. */
export const EXCLUDED_CODE_LABELS: Record<string, string> = {
  [EXCLUDED_CODES.GPU_WORKLOAD]: "GPU workload",
  [EXCLUDED_CODES.MEMORY_HPA]: "Memory HPA",
  [EXCLUDED_CODES.CPU_HPA]: "CPU HPA",
  [EXCLUDED_CODES.INCOMPLETE_STATS]: "Incomplete stats",
};

export interface WorkloadStatMetadata {
  excluded: boolean;
  /** Known values: GPU_WORKLOAD, MEMORY_HPA, CPU_HPA, INCOMPLETE_STATS */
  excluded_codes?: string[];
}

export interface WorkloadStatConstraints {
  blocking: boolean;
  pdb: boolean;
  do_not_disrupt_annotation: boolean;
  volume: boolean;
  affinity: boolean;
  topology_spread_constraint: boolean;
  pod_anti_affinity: boolean;
  excluded_annotation: boolean;
}

export interface WorkloadStat {
  workload: string;
  kind: string;
  namespace: string;
  name: string;
  creation_time: string;
  updated_at: string;
  is_horizontally_autoscaled_on_cpu: boolean;
  is_horizontally_autoscaled_on_memory: boolean;
  constraints?: WorkloadStatConstraints;
  eviction_ranking: number;
  replicas: number;
  container_stats: ContainerStats[];
  original_container_resources: Array<{
    name: string;
    type: number;
    cpu_request: number;
    cpu_limit: number;
    memory_request?: number;
    memory_limit?: number;
  }>;
  metadata?: WorkloadStatMetadata;
}

export interface StatsResponse {
  stats: WorkloadStat[];
}

export interface RecommendationAnalysisItem {
  workload_type: string;
  workload_namespace: string;
  workload_name: string;
  pod_name: string;
  container_name: string;
  cpu_usage_7_days: string;
  spike_range: number;
  request_gap: number;
  autoscaling_on_cpu: string;
  blocking_karpenter: string;
  node_name: string;
  current_requested_cpu: number;
  recommended_cpu: number;
  cpu_difference: number;
  current_requested_memory: number;
  recommended_memory: number;
  memory_difference: number;
}

export interface RecommendationSummary {
  total_current_cpu_requests: number;
  total_cpu_differences: number;
  total_current_memory_requests: number;
  total_memory_differences: number;
}

export interface RecommendationAnalysisResponse {
  analysis: RecommendationAnalysisItem[];
  summary: RecommendationSummary;
}

export interface WorkloadAnalysisItem {
  workload_type: string;
  workload_namespace: string;
  workload_name: string;
  container_name: string;
  container_type: number;
  cpu_usage_7_days: string;
  spike_range: number;
  request_gap: number;
  autoscaling_on_cpu: string;
  blocking_karpenter: string;
}

export interface PrometheusConfig {
  url: string;
  connected: boolean;
  error?: string;
  /** Backend / controller release version from GET .../config */
  version?: string;
}

export interface ClusterSettings {
  cpuPricePerCorePerHour: number;
  memoryPricePerGBPerHour: number;
}

export interface PrometheusQueryResult {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
    }>;
  };
}

export interface ImpactSummaryClusterResource {
  utilised: number;
  requested: number;
  allocatable: number;
}

export interface ImpactSummaryClusterResources {
  cpu: ImpactSummaryClusterResource;
  memory: ImpactSummaryClusterResource;
}

export interface ImpactSummary {
  dollarCurrentCost: number;
  dollarCurrentSavings: number;
  dollarPossibleSavings: number;
  clusterResources: ImpactSummaryClusterResources;
}

export interface WorkloadDetailConstraints {
  blockingConsolidation: boolean;
  pdb: boolean;
  doNotDisruptAnnotation: boolean;
  volume: boolean;
  affinity: boolean;
  topologySpreadConstraint: boolean;
  podAntiAffinity: boolean;
  excludedAnnotation: boolean;
  /** Whether the workload is identified as a GPU workload. */
  isGPUWorkload?: boolean;
}

export interface WorkloadDetailResourceRecommended {
  min: number;
  max: number;
  avg: number;
  change: number;
}

export interface WorkloadDetailResource {
  current: number;
  /** Average usage per pod (same units as `current`). From workloads summary API. */
  pod_current_avg?: number;
  podCurrentAvg?: number;
  recommended: WorkloadDetailResourceRecommended;
}

export interface WorkloadDetailDisruptionWindow {
  windowStartCron: string;
  windowEndCron: string;
}

export interface WorkloadDetailConfig {
  criticalityLevel: string;
  cruiseEnabled: boolean;
  disruptionSchedule: WorkloadDetailDisruptionWindow[];
  inDisruptionWindow: boolean;
  /** True if the workload has HPA on CPU or memory. */
  hpaEnabled?: boolean;
  /** Exclusion reason codes (e.g. GPU_WORKLOAD, CPU_HPA, MEMORY_HPA). Omitted when empty. */
  excludedCodes?: string[];
}

export interface WorkloadDetail {
  workloadID: string;
  kind: string;
  namespace: string;
  name: string;
  updatedAt: number;
  podsCount: number;
  /** True when the workload has been scaled down (e.g. fewer replicas). */
  scaledDown?: boolean;
  constraints: WorkloadDetailConstraints;
  cpu: WorkloadDetailResource;
  memory: WorkloadDetailResource;
  dollarSavingsPerMonth: number;
  dollarExpenditurePerMonth: number;
  config: WorkloadDetailConfig;
}

export interface WorkloadSummaryResponse {
  impactSummary: ImpactSummary;
  workloadDetails: WorkloadDetail[];
}

/** Adoption coverage: three-way workload classification with explicit total. */
export interface OverviewAdoptionCoverage {
  optimizable: number;
  nonOptimizable: number;
  optimizableButExcluded: number;
  total: number;
}

/** Coverage counts for CPU/Memory (enabled vs disabled). API may return "enabed" typo. */
export interface OverviewCoveragePair {
  enabled?: number;
  enabed?: number;
  disabled?: number;
}

export interface OverviewCoverage {
  adoption: OverviewAdoptionCoverage;
  cpuCoverage: OverviewCoveragePair;
  memoryCoverage: OverviewCoveragePair;
}

export interface OverviewResourceStats {
  allocatable: number;
  requested: number;
  /** Total CPU/memory requested by workloads from manifests (CPU in cores, memory in GiB). */
  workloadRequested?: number;
  usage: number;
  recommended: number;
}

export interface OverviewResponse {
  currentMonthlyCost?: number;
  currentSavings?: number;
  possibleSavings?: number;
  clusterUtilisation?: number;
  nodeCount?: number;
  coverage?: OverviewCoverage;
  cpuStats?: OverviewResourceStats;
  memoryStats?: OverviewResourceStats;
}

/** Single data point in historical timeline API response. */
export interface HistoricalTimelineDataPoint {
  legend: string;
  color: string;
  threshold: { value: number; color: string };
  data: { timestamp: string; value: number };
}

/** Response from GET .../ui/overview/historical-timeline/:metric?startTime=...&endTime=... */
export interface HistoricalTimelineResponse {
  data: HistoricalTimelineDataPoint[];
}

/** Container in workload detail pod (from GET .../workloads/:namespace/:workload/detail). */
export interface WorkloadDetailPodContainer {
  container_name: string;
  /** Declared workload request from manifest (cores / MB). */
  cpu_request: number;
  cpu_rec_request: number;
  mem_request: number;
  mem_rec_request: number;
  /** Observed effective request for this pod/container (cores). */
  current_cpu_request?: number;
  /** Observed effective request for this pod/container (MB). */
  current_mem_request?: number;
}

/** Pod in workload detail response. */
export interface WorkloadDetailPod {
  pod_name: string;
  node_name: string;
  containers: WorkloadDetailPodContainer[];
}

/** Response from GET /clusters/:clusterID/workloads/:namespace/:workloadName/detail */
export interface WorkloadDetailResponse {
  cluster: string;
  namespace: string;
  workload: string;
  type: string;
  current_cpu_request: number;
  current_cpu_limit: number;
  current_mem_request: number;
  current_mem_limit: number;
  /** Average effective CPU request per pod (cores). */
  current_pod_avg_cpu_request?: number;
  /** Average effective memory request per pod (MB). */
  current_pod_avg_mem_request?: number;
  potential_cpu_savings: number;
  potential_mem_savings: number;
  pods: WorkloadDetailPod[];
}

/** Kubernetes workload target for an audit event. */
export interface AuditEventTarget {
  kind: string;
  name: string;
  namespace: string;
}

/** Payload for an audit event (message, target, details as raw object). */
export interface AuditEventPayload {
  message?: string;
  target?: AuditEventTarget;
  details?: Record<string, unknown>;
}

/** Single audit event from GET .../clusters/:clusterID/audit-events?minutes=... */
export interface AuditEvent {
  cluster_id: string;
  type: string;
  category: string;
  payload: AuditEventPayload;
  created_at: string;
}

/** Response from GET .../clusters/:clusterID/audit-events?minutes=... */
export interface AuditEventsResponse {
  events: AuditEvent[];
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const skipAuth = isAuthSkippedRequest(endpoint, options);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (!skipAuth) {
      const auth = getBasicAuthorizationHeader();
      if (auth) {
        headers.Authorization = auth;
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && !skipAuth) {
        unauthorizedHandler?.();
      }

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData: ApiError = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (_) {
          void _;
        }
        throw new Error(errorMessage);
      }

      const data: T = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /** POST /api/auth/login → POST /api/v1/auth/login. No Authorization header. */
  async login(body: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** GET /api/ -> GET /api/v1/ (unprotected). Returns server info including auth_enabled. */
  async getAuthInfo(): Promise<AuthInfoResponse> {
    return this.request<AuthInfoResponse>('/');
  }

  async getClusters(): Promise<ClustersResponse> {
    const data = await this.request<ClustersResponse | null>('/clusters');
    if (data == null) {
      return { clusters: [], count: 0, cluster_mode: '' };
    }
    return {
      ...data,
      clusters: Array.isArray(data.clusters) ? data.clusters : [],
    };
  }

  async getWorkloadAnalysis(clusterID: string): Promise<WorkloadAnalysisItem[]> {
    const data = await this.request<WorkloadAnalysisItem[] | null>(`/clusters/${clusterID}/workload-analysis`);
    return Array.isArray(data) ? data : [];
  }

  async getWorkloadsSummary(clusterID: string): Promise<WorkloadSummaryResponse> {
    return this.request<WorkloadSummaryResponse>(`/clusters/${clusterID}/workloads/summary`);
  }

  /** GET /api/clusters/:clusterID/ui/overview — overview metrics for the Overview page. */
  async getOverview(clusterID: string): Promise<OverviewResponse> {
    return this.request<OverviewResponse>(`/clusters/${clusterID}/ui/overview`);
  }

  /** GET /api/clusters/:clusterID/ui/overview/historical-timeline/:metric — historical timeline for CPU, memory, or cost. */
  async getHistoricalTimeline(
    clusterID: string,
    metric: 'cpu' | 'memory' | 'cost',
    startTime: string,
    endTime: string
  ): Promise<HistoricalTimelineResponse> {
    const params = new URLSearchParams({
      startTime,
      endTime,
    });
    return this.request<HistoricalTimelineResponse>(
      `/clusters/${clusterID}/ui/overview/historical-timeline/${metric}?${params.toString()}`
    );
  }

  async updateWorkloadOverrides(
    clusterID: string,
    workloadID: string,
    overrides: Overrides
  ): Promise<Overrides> {
    return this.request<Overrides>(`/clusters/${clusterID}/workloads/${workloadID}/overrides`, {
      method: 'POST',
      body: JSON.stringify(overrides),
    });
  }

  /** Batch update overrides for multiple workloads. POST .../workloads/overrides */
  async batchWorkloadOverrides(
    clusterID: string,
    workloadIds: string[],
    overrides: Overrides
  ): Promise<void> {
    if (workloadIds.length === 0) throw new Error('workload_ids must not be empty');
    return this.request<void>(`/clusters/${clusterID}/workloads/overrides`, {
      method: 'POST',
      body: JSON.stringify({ workload_ids: workloadIds, overrides }),
    });
  }

  /** Fetches workload detail. GET /clusters/:clusterID/workloads/:namespace/:workloadName/detail */
  async getWorkloadDetail(
    clusterID: string,
    namespace: string,
    workloadName: string
  ): Promise<WorkloadDetailResponse> {
    return this.request<WorkloadDetailResponse>(
      `/clusters/${encodeURIComponent(clusterID)}/workloads/${encodeURIComponent(namespace)}/${encodeURIComponent(workloadName)}/detail`
    );
  }

  /** Fetches cluster config (Prometheus). Endpoint: GET /clusters/:clusterID/config */
  async getConfig(clusterID: string): Promise<PrometheusConfig> {
    return this.request<PrometheusConfig>(`/clusters/${clusterID}/config`);
  }

  /** Fetches cluster cost settings. Endpoint: GET /clusters/:clusterID/settings */
  async getSettings(clusterID: string): Promise<ClusterSettings> {
    return this.request<ClusterSettings>(`/clusters/${clusterID}/settings`);
  }

  /** Updates cluster cost settings. Endpoint: PUT /clusters/:clusterID/settings */
  async updateSettings(clusterID: string, settings: ClusterSettings): Promise<ClusterSettings> {
    return this.request<ClusterSettings>(`/clusters/${clusterID}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  /**
   * GET .../clusters/:clusterID/audit-events?minutes= — all events.
   * GET .../clusters/:clusterID/audit-events/:workloadId?minutes= — events for one workload.
   * workloadId format: TYPE:NAMESPACE:NAME (e.g. Deployment:my-ns:my-app).
   */
  async getAuditEvents(clusterID: string, minutes: number, workloadId?: string): Promise<AuditEventsResponse> {
    const base = `/clusters/${encodeURIComponent(clusterID)}/audit-events`;
    const path = workloadId?.trim()
      ? `${base}/${encodeURIComponent(workloadId.trim())}?minutes=${encodeURIComponent(String(minutes))}`
      : `${base}?minutes=${encodeURIComponent(String(minutes))}`;
    const data = await this.request<AuditEventsResponse | null>(path);
    if (data == null || !Array.isArray(data.events)) {
      return { events: [] };
    }
    return { events: data.events };
  }
}

export const apiClient = new ApiClient();

const API_BASE_URL = '/api';

export interface ApiError {
  error: string;
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
} as const;
export type ExcludedCode = (typeof EXCLUDED_CODES)[keyof typeof EXCLUDED_CODES];

/** Human-readable labels for excluded codes. Unknown codes are shown as-is. */
export const EXCLUDED_CODE_LABELS: Record<string, string> = {
  [EXCLUDED_CODES.GPU_WORKLOAD]: "GPU workload",
  [EXCLUDED_CODES.MEMORY_HPA]: "Memory HPA",
  [EXCLUDED_CODES.CPU_HPA]: "CPU HPA",
};

export interface WorkloadStatMetadata {
  excluded: boolean;
  /** Known values: GPU_WORKLOAD, MEMORY_HPA, CPU_HPA */
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
  continuous_optimization: boolean;
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
  applyRecommendationDryRun: boolean;
  error?: string;
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
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

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

  /** Normalizes empty response: API may return {"stats": null}. Always returns { stats: array }. */
  async getClusterStats(clusterID: string): Promise<StatsResponse> {
    const data = await this.request<StatsResponse | null>(`/clusters/${clusterID}/stats`);
    if (data == null) {
      return { stats: [] };
    }
    /** Normalized stats array (workload stats with container_stats, original_container_resources). */
    const stats = data.stats != null && Array.isArray(data.stats) ? data.stats : [];
    return { ...data, stats };
  }

  /** Fetches workloads from /workloads. Every workload must have a valid overrides object; otherwise throws. */
  async getWorkloads(clusterID: string): Promise<WorkloadOverrideInfo[]> {
    const data = await this.request<WorkloadOverrideInfo[] | null>(`/clusters/${clusterID}/workloads`);
    if (data == null || !Array.isArray(data)) {
      return [];
    }
    return data.map((w) => this.assertWorkloadOverrides(w));
  }

  /** Validates that a workload has a valid overrides object. Throws if missing or invalid. */
  private assertWorkloadOverrides(
    w: { workload_id: string; name: string; namespace: string; kind: string; overrides?: unknown }
  ): WorkloadOverrideInfo {
    const raw = w.overrides;
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(
        `getWorkloads: workload at index has missing or invalid overrides (workload_id=${w.workload_id}, name=${w.name})`
      );
    }
    const o = raw as Record<string, unknown>;
    if (typeof o.eviction_ranking !== 'number') {
      throw new Error(
        `getWorkloads: workload overrides.eviction_ranking must be a number (workload_id=${w.workload_id}, name=${w.name})`
      );
    }
    if (typeof o.enabled !== 'boolean') {
      throw new Error(
        `getWorkloads: workload overrides.enabled must be a boolean (workload_id=${w.workload_id}, name=${w.name})`
      );
    }
    let disruption_windows: DisruptionWindow[] | undefined;
    if (Array.isArray(o.disruption_windows)) {
      disruption_windows = o.disruption_windows.filter(
        (w): w is DisruptionWindow =>
          w != null && typeof w === 'object' && typeof (w as DisruptionWindow).start_cron === 'string' && typeof (w as DisruptionWindow).end_cron === 'string'
      ) as DisruptionWindow[];
      if (disruption_windows.length === 0) disruption_windows = undefined;
    }
    return {
      workload_id: w.workload_id,
      name: w.name,
      namespace: w.namespace,
      kind: w.kind,
      overrides: {
        eviction_ranking: o.eviction_ranking,
        enabled: o.enabled,
        ...(disruption_windows != null && disruption_windows.length > 0 ? { disruption_windows } : {}),
      },
    };
  }

  /** Normalizes empty response: API may return { "analysis": null, "summary": {...} }. Always returns { analysis: array, summary }. */
  async getRecommendationAnalysis(clusterID: string): Promise<RecommendationAnalysisResponse> {
    const data = await this.request<RecommendationAnalysisResponse | null>(`/clusters/${clusterID}/recommendation-analysis`);
    const defaultSummary: RecommendationSummary = {
      total_current_cpu_requests: 0,
      total_cpu_differences: 0,
      total_current_memory_requests: 0,
      total_memory_differences: 0,
    };
    if (data == null) {
      return { analysis: [], summary: defaultSummary };
    }
    /** Normalized analysis array (per-container recommendation items). */
    const analysis = data.analysis != null && Array.isArray(data.analysis) ? data.analysis : [];
    /** Summary totals (current requests, differences) from the API. */
    const summary = data.summary ?? defaultSummary;
    return { ...data, analysis, summary };
  }

  async getWorkloadAnalysis(clusterID: string): Promise<WorkloadAnalysisItem[]> {
    const data = await this.request<WorkloadAnalysisItem[] | null>(`/clusters/${clusterID}/workload-analysis`);
    return Array.isArray(data) ? data : [];
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

  /** Fetches cluster config (Prometheus, applyRecommendationDryRun). Endpoint: GET /clusters/:clusterID/config */
  async getConfig(clusterID: string): Promise<PrometheusConfig> {
    return this.request<PrometheusConfig>(`/clusters/${clusterID}/config`);
  }

  async queryPrometheus(clusterID: string, query: string): Promise<PrometheusQueryResult> {
    const encodedQuery = encodeURIComponent(query);
    return this.request<PrometheusQueryResult>(`/clusters/${clusterID}/prometheus-query?query=${encodedQuery}`);
  }
}

export const apiClient = new ApiClient();

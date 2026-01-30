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

export interface WorkloadOverrideInfo {
  workload_id: string;
  name: string;
  namespace: string;
  kind: string;
  eviction_ranking: number;
  enabled: boolean;
}

export interface Overrides {
  eviction_ranking?: number;
  enabled?: boolean;
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

export interface WorkloadStat {
  workload: string;
  kind: string;
  namespace: string;
  name: string;
  creation_time: string;
  updated_at: string;
  continuous_optimization: boolean;
  is_horizontally_autoscaled_on_cpu: boolean;
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
    const stats = data.stats != null && Array.isArray(data.stats) ? data.stats : [];
    return { ...data, stats };
  }

  /** Normalizes empty response: API may return [] or null. Always returns an array. */
  async getWorkloads(clusterID: string): Promise<WorkloadOverrideInfo[]> {
    const data = await this.request<WorkloadOverrideInfo[] | null>(`/clusters/${clusterID}/workloads`);
    if (data == null || !Array.isArray(data)) {
      return [];
    }
    return data;
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
    const analysis = data.analysis != null && Array.isArray(data.analysis) ? data.analysis : [];
    const summary = data.summary ?? defaultSummary;
    return { ...data, analysis, summary };
  }

  async getWorkloadAnalysis(clusterID: string): Promise<WorkloadAnalysisItem[]> {
    const data = await this.request<WorkloadAnalysisItem[] | null>(`/clusters/${clusterID}/workload-analysis`);
    return Array.isArray(data) ? data : [];
  }

  async getWorkloadOverrides(clusterID: string, workloadID: string): Promise<Overrides> {
    return this.request<Overrides>(`/clusters/${clusterID}/workloads/${workloadID}/overrides`);
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

  async getPrometheusConfig(clusterID: string): Promise<PrometheusConfig> {
    return this.request<PrometheusConfig>(`/clusters/${clusterID}/prometheus-config`);
  }

  async queryPrometheus(clusterID: string, query: string): Promise<PrometheusQueryResult> {
    const encodedQuery = encodeURIComponent(query);
    return this.request<PrometheusQueryResult>(`/clusters/${clusterID}/prometheus-query?query=${encodedQuery}`);
  }
}

export const apiClient = new ApiClient();

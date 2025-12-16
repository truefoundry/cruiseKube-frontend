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
    return this.request<ClustersResponse>('/clusters');
  }

  async getClusterStats(clusterID: string): Promise<StatsResponse> {
    return this.request<StatsResponse>(`/clusters/${clusterID}/stats`);
  }

  async getWorkloads(clusterID: string): Promise<WorkloadOverrideInfo[]> {
    return this.request<WorkloadOverrideInfo[]>(`/clusters/${clusterID}/workloads`);
  }

  async getRecommendationAnalysis(clusterID: string): Promise<RecommendationAnalysisResponse> {
    return this.request<RecommendationAnalysisResponse>(`/clusters/${clusterID}/recommendation-analysis`);
  }

  async getWorkloadAnalysis(clusterID: string): Promise<WorkloadAnalysisItem[]> {
    return this.request<WorkloadAnalysisItem[]>(`/clusters/${clusterID}/workload-analysis`);
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
}

export const apiClient = new ApiClient();

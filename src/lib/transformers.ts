import {
  StatsResponse,
  WorkloadStat,
  ContainerStats,
  RecommendationAnalysisItem,
  RecommendationAnalysisResponse,
  WorkloadOverrideInfo,
} from './api';

const CPU_COST_PER_CORE_PER_HOUR = 0.029;
const MEMORY_COST_PER_GB_PER_HOUR = 0.0075;

export interface FrontendWorkload {
  id: string;
  namespace: string;
  workload: string;
  type: string;
  potentialCpu: string;
  potentialMem: string;
  currentCpu: string;
  recommendedCpu: string;
  currentMem: string;
  recommendedMem: string;
  potentialDollars: number;
  lastUpdated: string;
  mode: 'enabled' | 'recommend-only';
  priority: 'low' | 'medium' | 'high' | 'non-evictable';
  hasRecommendations: boolean;
}

export interface FrontendContainer {
  name: string;
  cpuCurrent: string;
  cpuRecommended: string;
  memCurrent: string;
  memRecommended: string;
}

export enum ContainerType {
  INIT_CONTAINER = 1,
  SIDECAR_CONTAINER = 2,
  APP_CONTAINER = 3,
}

export enum EvictionRanking {
  EvictionRankingDisabled = 1,
  EvictionRankingHigh = 2,
  EvictionRankingMedium = 3,
  EvictionRankingLow = 4,
}

export interface FrontendPodRecommendation {
  pod: string;
  cpuRequest: string;
  cpuLimit: string;
  cpuRecRequest: string;
  cpuRecLimit: string;
  memRequest: string;
  memLimit: string;
  memRecRequest: string;
  memRecLimit: string;
  usageP99: string;
  usageP50: string;
}

export interface FrontendContainerRecommendation {
  container: string;
  cpuRequest: string;
  cpuRecRequest: string;
  memRequest: string;
  memRecRequest: string;
}

export interface OverviewMetrics {
  optimizationScore: number;
  coverage: number;
  potentialSavings: {
    cpu: number;
    memory: number;
    dollars: number;
  };
  realizedSavings: {
    cpu: number;
    memory: number;
    dollars: number;
  };
  reliabilityIssues: number;
  costOptimizedWorkloads: number;
  totalSavedPerHour: number;
  realizedDollars: number;
  unrealizedDollars: number;
}

export interface WastefulWorkload {
  namespace: string;
  workload: string;
  containers: number;
  savingsPerHour: number;
  type: string;
}

function formatCpu(cores: number): string {
  if (cores < 1) {
    return `${Math.round(cores * 1000)}m`;
  }
  return `${cores.toFixed(1)} cores`;
}

function formatMemory(mb: number): string {
  if (mb < 1024) {
    return `${Math.round(mb)}Mi`;
  }
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatCpuRange(min: number, max: number): string {
  return `${formatCpu(min)}-${formatCpu(max)}`;
}

function formatMemoryRange(min: number, max: number): string {
  return `${formatMemory(min)}-${formatMemory(max)}`;
}

export type RecommendationMap = Map<string, { cpu: number[]; memory: number[] }>;

export function buildRecommendationMap(analysis: RecommendationAnalysisItem[]): RecommendationMap {
  const map = new Map<string, { cpu: number[]; memory: number[] }>();
  const items = Array.isArray(analysis) ? analysis : [];
  for (const item of items) {
    const key = `${item.workload_namespace}:${item.workload_name}:${item.container_name}`;
    const existing = map.get(key);
    
    if (existing) {
      existing.cpu.push(item.recommended_cpu);
      existing.memory.push(item.recommended_memory);
    } else {
      map.set(key, {
        cpu: [item.recommended_cpu],
        memory: [item.recommended_memory],
      });
    }
  }
  
  return map;
}

function calculateRecommendedCpu(
  containerStat: ContainerStats,
  namespace: string,
  workloadName: string,
  currentCpu: number,
  recommendationMap?: RecommendationMap
): number[] {
  if (recommendationMap) {
    const key = `${namespace}:${workloadName}:${containerStat.container_name}`;
    const recommendation = recommendationMap.get(key);
    if (recommendation && recommendation.cpu.length > 0) {
      const validCpu = recommendation.cpu.filter(cpu => cpu > 0);
      return validCpu;
    }
  }
  return [currentCpu];
}

function calculateRecommendedMemory(
  containerStat: ContainerStats,
  namespace: string,
  workloadName: string,
  currentMemory: number,
  recommendationMap?: RecommendationMap
): number[] {
  if (recommendationMap) {
    const key = `${namespace}:${workloadName}:${containerStat.container_name}`;
    const recommendation = recommendationMap.get(key);
    if (recommendation && recommendation.memory.length > 0) {
      const validMemory = recommendation.memory.filter(mem => mem > 0);
      if (validMemory.length > 0) {
        return validMemory;
      }
    }
  }
  return [currentMemory];
}

export function mapEvictionRankingToPriority(ranking: EvictionRanking): 'high' | 'medium' | 'low' | 'non-evictable' {
  switch (ranking) {
    case EvictionRanking.EvictionRankingDisabled:
      return 'non-evictable';
    case EvictionRanking.EvictionRankingHigh:
      return 'high';
    case EvictionRanking.EvictionRankingMedium:
      return 'medium';  
    case EvictionRanking.EvictionRankingLow:
      return 'low';
  }
}

export function mapPriorityToEvictionRanking(priority: 'low' | 'medium' | 'high' | 'non-evictable'): number {
  switch (priority) {
    case 'low':
      return EvictionRanking.EvictionRankingLow;
    case 'medium':
      return EvictionRanking.EvictionRankingMedium;
    case 'high':
      return EvictionRanking.EvictionRankingHigh;
    case 'non-evictable':
      return EvictionRanking.EvictionRankingDisabled;
  }
}

function calculateDollarSavings(cpuCores: number, memoryGB: number): number {
  const hoursPerMonth = 720;
  return Math.round((cpuCores * CPU_COST_PER_CORE_PER_HOUR + memoryGB * MEMORY_COST_PER_GB_PER_HOUR) * hoursPerMonth * 100) / 100;
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const updated = new Date(timestamp);
  const diffMs = now.getTime() - updated.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${diffDays} days ago`;
}

export function transformWorkloadStatToFrontend(
  stat: WorkloadStat,
  override?: WorkloadOverrideInfo,
  recommendationAnalysis?: RecommendationAnalysisItem[]
): FrontendWorkload {
  const workloadId = stat.workload;
  
  let totalCurrentCpu = 0;
  let totalCurrentMemory = 0;
  let hasRecommendations = false;

  const recommendationMap = recommendationAnalysis ? buildRecommendationMap(recommendationAnalysis) : undefined;
  const containerStats = Array.isArray(stat.container_stats) ? stat.container_stats : [];
  const originalResources = Array.isArray(stat.original_container_resources) ? stat.original_container_resources : [];

  for (const containerStat of containerStats) {
    const originalResource = originalResources.find(
      r => r.name === containerStat.container_name
    );

    if (!originalResource) continue;

    const currentCpu = originalResource.cpu_request || 0;
    const currentMemory = originalResource.memory_request || 0;
    const recommendedCpuArray = calculateRecommendedCpu(containerStat, stat.namespace, stat.name, currentCpu, recommendationMap);
    const recommendedMemoryArray = calculateRecommendedMemory(containerStat, stat.namespace, stat.name, currentMemory, recommendationMap);

    if (recommendedCpuArray.length > 0 || recommendedMemoryArray.length > 0) {
      hasRecommendations = true;
    }

    if (containerStat.container_type === ContainerType.SIDECAR_CONTAINER || containerStat.container_type === ContainerType.APP_CONTAINER) {
      totalCurrentCpu += currentCpu;
      totalCurrentMemory += currentMemory;
    } else if (containerStat.container_type === ContainerType.INIT_CONTAINER) {
      totalCurrentCpu = Math.max(totalCurrentCpu, currentCpu);
      totalCurrentMemory = Math.max(totalCurrentMemory, currentMemory);
    }
  }

  let recommendedCpu: string;
  let recommendedMem: string;
  let totalRecommendedMemory = 0;
  let totalPotentialCpuDiff = 0;
  let totalPotentialMemoryDiff = 0;

  const analysisList = Array.isArray(recommendationAnalysis) ? recommendationAnalysis : [];
  if (analysisList.length > 0) {
    const workloadRecommendations = analysisList.filter(
      item => 
        item.workload_namespace === stat.namespace &&
        item.workload_name === stat.name
    );

    if (workloadRecommendations.length > 0) {
      const podCurrentTotals = new Map<string, { cpu: number; memory: number }>();
      const podRecommendedTotals = new Map<string, { cpu: number; memory: number }>();

      for (const item of workloadRecommendations) {
        const podKey = item.pod_name;
        
        const currentExisting = podCurrentTotals.get(podKey) || { cpu: 0, memory: 0 };
        currentExisting.cpu += item.current_requested_cpu;
        currentExisting.memory += item.current_requested_memory;
        podCurrentTotals.set(podKey, currentExisting);

        const recommendedExisting = podRecommendedTotals.get(podKey) || { cpu: 0, memory: 0 };
        recommendedExisting.cpu += item.recommended_cpu;
        recommendedExisting.memory += item.recommended_memory;
        podRecommendedTotals.set(podKey, recommendedExisting);
      }

      const cpuValues = Array.from(podRecommendedTotals.values()).map(p => p.cpu).filter(cpu => cpu > 0);
      const memValues = Array.from(podRecommendedTotals.values()).map(p => p.memory).filter(mem => mem > 0);

      if (cpuValues.length > 0) {
        const cpuMin = Math.min(...cpuValues);
        const cpuMax = Math.max(...cpuValues);
        if (cpuMin === cpuMax) {
          recommendedCpu = formatCpu(cpuMin);
        } else {
          recommendedCpu = formatCpuRange(cpuMin, cpuMax);
        }
      } else {
        recommendedCpu = formatCpu(totalCurrentCpu);
      }

      if (memValues.length > 0) {
        const memMin = Math.min(...memValues);
        const memMax = Math.max(...memValues);
        totalRecommendedMemory = memMax;
        if (memMin === memMax) {
          recommendedMem = formatMemory(memMin);
        } else {
          recommendedMem = formatMemoryRange(memMin, memMax);
        }
      } else {
        recommendedMem = formatMemory(totalCurrentMemory);
      }

      for (const [podKey, currentPod] of podCurrentTotals) {
        const recommendedPod = podRecommendedTotals.get(podKey) || { cpu: 0, memory: 0 };
        const podCpuDiff = currentPod.cpu > recommendedPod.cpu ? currentPod.cpu - recommendedPod.cpu : 0;
        const podMemDiff = currentPod.memory > recommendedPod.memory ? currentPod.memory - recommendedPod.memory : 0;
        totalPotentialCpuDiff += podCpuDiff;
        totalPotentialMemoryDiff += podMemDiff;
      }
    } else {
      recommendedCpu = formatCpu(totalCurrentCpu);
      recommendedMem = formatMemory(totalCurrentMemory);
      totalRecommendedMemory = totalCurrentMemory;
      totalPotentialCpuDiff = 0;
      totalPotentialMemoryDiff = 0;
    }
  } else {
    recommendedCpu = formatCpu(totalCurrentCpu);
    recommendedMem = formatMemory(totalCurrentMemory);
    totalRecommendedMemory = totalCurrentMemory;
    totalPotentialCpuDiff = 0;
    totalPotentialMemoryDiff = 0;
  }

  const potentialMemoryGB = totalPotentialMemoryDiff / 1024;
  const potentialDollars = calculateDollarSavings(totalPotentialCpuDiff, potentialMemoryGB);

  const enabled = !override || override?.enabled;
  const evictionRanking = override?.eviction_ranking ?? stat.eviction_ranking;

  return {
    id: workloadId,
    namespace: stat.namespace,
    workload: stat.name,
    type: stat.kind,
    potentialCpu: formatCpu(totalPotentialCpuDiff),
    potentialMem: formatMemory(totalPotentialMemoryDiff),
    currentCpu: formatCpu(totalCurrentCpu),
    recommendedCpu,
    currentMem: formatMemory(totalCurrentMemory),
    recommendedMem,
    potentialDollars,
    lastUpdated: formatTimeAgo(stat.updated_at),
    mode: enabled ? 'enabled' : 'recommend-only',
    priority: mapEvictionRankingToPriority(evictionRanking),
    hasRecommendations,
  };
}

export function transformStatsToWorkloads(
  statsResponse: StatsResponse,
  overrides: WorkloadOverrideInfo[] = [],
  recommendationAnalysis?: RecommendationAnalysisItem[]
): FrontendWorkload[] {
  const stats = Array.isArray(statsResponse?.stats) ? statsResponse.stats : [];
  const overrideList = Array.isArray(overrides) ? overrides : [];
  const overrideMap = new Map(overrideList.map(o => [o.workload_id, o]));
  
  return stats.map(stat => {
    const workloadId = stat.workload;
    const override = overrideMap.get(workloadId);
    return transformWorkloadStatToFrontend(stat, override, recommendationAnalysis);
  });
}

export function transformWorkloadStatToContainers(
  stat: WorkloadStat,
  recommendationAnalysis?: RecommendationAnalysisItem[]
): FrontendContainer[] {
  const containerStats = Array.isArray(stat.container_stats) ? stat.container_stats : [];
  const originalResources = Array.isArray(stat.original_container_resources) ? stat.original_container_resources : [];
  return containerStats
    .filter(cs => cs.container_type === 2 || cs.container_type === 3)
    .map(containerStat => {
      const originalResource = originalResources.find(
        r => r.name === containerStat.container_name
      );

      if (!originalResource) {
        return null;
      }

      const currentCpu = originalResource.cpu_request || 0;
      const currentMemory = originalResource.memory_request || 0;

      let cpuRecommended: string;
      let memRecommended: string;
      let recommendedCpu = 0;
      let recommendedMemory = 0;

      if (recommendationAnalysis) {
        const recList = Array.isArray(recommendationAnalysis) ? recommendationAnalysis : [];
        const containerRecommendations = recList.filter(
          item => 
            item.workload_namespace === stat.namespace &&
            item.workload_name === stat.name &&
            item.container_name === containerStat.container_name
        );

        if (containerRecommendations.length > 0) {
          const cpuValues = containerRecommendations.map(item => item.recommended_cpu).filter(cpu => cpu > 0);
          const memValues = containerRecommendations.map(item => item.recommended_memory).filter(mem => mem > 0);

          if (cpuValues.length > 0) {
            const cpuMin = Math.min(...cpuValues);
            const cpuMax = Math.max(...cpuValues);
            recommendedCpu = cpuMax;
            if (cpuMin === cpuMax) {
              cpuRecommended = formatCpu(cpuMin);
            } else {
              cpuRecommended = formatCpuRange(cpuMin, cpuMax);
            }
          } else {
            recommendedCpu = currentCpu;
            cpuRecommended = formatCpu(currentCpu);
          }

          if (memValues.length > 0) {
            const memMin = Math.min(...memValues);
            const memMax = Math.max(...memValues);
            recommendedMemory = memMax;
            if (memMin === memMax) {
              memRecommended = formatMemory(memMin);
            } else {
              memRecommended = formatMemoryRange(memMin, memMax);
            }
          } else {
            recommendedMemory = currentMemory;
            memRecommended = formatMemory(currentMemory);
          }
        } else {
          recommendedCpu = currentCpu;
          recommendedMemory = currentMemory;
          cpuRecommended = formatCpu(currentCpu);
          memRecommended = formatMemory(currentMemory);
        }
      } else {
        recommendedCpu = currentCpu;
        recommendedMemory = currentMemory;
        cpuRecommended = formatCpu(currentCpu);
        memRecommended = formatMemory(currentMemory);
      }

      return {
        name: containerStat.container_name,
        cpuCurrent: formatCpu(currentCpu),
        cpuRecommended,
        memCurrent: formatMemory(currentMemory),
        memRecommended,
      };
    })
    .filter((c): c is FrontendContainer => c !== null);
}

export function transformRecommendationAnalysisToPodRecommendations(
  analysis: RecommendationAnalysisItem[]
): FrontendPodRecommendation[] {
  const items = Array.isArray(analysis) ? analysis : [];
  return items.map(item => {
    const cpuRequest = item.current_requested_cpu;
    const cpuRecommended = item.recommended_cpu;
    const memRequest = item.current_requested_memory;
    const memRecommended = item.recommended_memory;

    const cpuUsageParts = (item.cpu_usage_7_days ?? '').split(' / ').map(parseFloat);
    const usageP99 = cpuUsageParts.length > 1 ? `${Math.round(cpuUsageParts[1] * 100)}%` : 'N/A';
    const usageP50 = cpuUsageParts.length > 4 ? `${Math.round(cpuUsageParts[4] * 100)}%` : 'N/A';

    return {
      pod: item.pod_name,
      cpuRequest: formatCpu(cpuRequest),
      cpuLimit: formatCpu(cpuRequest * 2),
      cpuRecRequest: formatCpu(cpuRecommended),
      cpuRecLimit: formatCpu(cpuRecommended * 2),
      memRequest: formatMemory(memRequest),
      memLimit: formatMemory(memRequest * 2),
      memRecRequest: formatMemory(memRecommended),
      memRecLimit: formatMemory(memRecommended * 2),
      usageP99,
      usageP50,
    };
  });
}

export function transformStatsToOverviewMetrics(
  statsResponse: StatsResponse,
  overrides: WorkloadOverrideInfo[] = [],
  recommendationAnalysis?: RecommendationAnalysisItem[]
): OverviewMetrics {
  const stats = Array.isArray(statsResponse?.stats) ? statsResponse.stats : [];
  if (stats.length === 0) {
    return {
      optimizationScore: 100,
      coverage: 0,
      potentialSavings: { cpu: 0, memory: 0, dollars: 0 },
      realizedSavings: { cpu: 0, memory: 0, dollars: 0 },
      reliabilityIssues: 0,
      costOptimizedWorkloads: 0,
      totalSavedPerHour: 0,
      realizedDollars: 0,
      unrealizedDollars: 0,
    };
  }

  const overrideList = Array.isArray(overrides) ? overrides : [];
  const overrideMap = new Map(overrideList.map(o => [o.workload_id, o]));
  const recommendationMap = recommendationAnalysis ? buildRecommendationMap(recommendationAnalysis) : undefined;
  
  let totalPotentialCpu = 0;
  let totalPotentialMemory = 0;
  let totalRealizedCpu = 0;
  let totalRealizedMemory = 0;
  let workloadsWithRecommendations = 0;
  let reliabilityIssues = 0;
  let costOptimizedWorkloads = 0;
  const wastePercentages: number[] = [];

  for (const stat of stats) {
    const workloadId = stat.workload;
    const override = overrideMap.get(workloadId);
    const enabled = override?.enabled ?? stat.continuous_optimization;

    let workloadCurrentCpu = 0;
    let workloadRecommendedCpu = 0;
    let workloadCurrentMemory = 0;
    let workloadRecommendedMemory = 0;
    let hasRecommendations = false;

    const statContainerStats = Array.isArray(stat.container_stats) ? stat.container_stats : [];
    const statOriginalResources = Array.isArray(stat.original_container_resources) ? stat.original_container_resources : [];
    for (const containerStat of statContainerStats) {
      const originalResource = statOriginalResources.find(
        r => r.name === containerStat.container_name
      );

      if (!originalResource) continue;

      const currentCpu = originalResource.cpu_request || 0;
      const currentMemory = originalResource.memory_request || 0;
      const recommendedCpuArray = calculateRecommendedCpu(containerStat, stat.namespace, stat.name, currentCpu, recommendationMap);
      const recommendedMemoryArray = calculateRecommendedMemory(containerStat, stat.namespace, stat.name, currentMemory, recommendationMap);

      if (recommendedCpuArray.some(cpu => cpu > 0) || recommendedMemoryArray.some(mem => mem > 0)) {
        hasRecommendations = true;
      }

      if (containerStat.container_type === ContainerType.SIDECAR_CONTAINER || containerStat.container_type === ContainerType.APP_CONTAINER) {
        workloadCurrentCpu += currentCpu;
        workloadRecommendedCpu += recommendedCpuArray.reduce((sum, cpu) => sum + cpu, 0);
        workloadCurrentMemory += currentMemory;
        workloadRecommendedMemory += recommendedMemoryArray.reduce((sum, mem) => sum + mem, 0);
      } else if (containerStat.container_type === ContainerType.INIT_CONTAINER) {
        workloadCurrentCpu = Math.max(workloadCurrentCpu, currentCpu);
        workloadRecommendedCpu = Math.max(workloadRecommendedCpu, Math.max(...recommendedCpuArray));
        workloadCurrentMemory = Math.max(workloadCurrentMemory, currentMemory);
        workloadRecommendedMemory = Math.max(workloadRecommendedMemory, Math.max(...recommendedMemoryArray));
      }
    }

    if (hasRecommendations) {
      workloadsWithRecommendations++;
    }

    let potentialCpuDiff = 0;
    let potentialMemoryDiff = 0;
    let workloadTotalCurrentCpu = 0;
    let workloadTotalCurrentMemory = 0;
    let workloadTotalRecommendedCpu = 0;
    let workloadTotalRecommendedMemory = 0;

    if (recommendationAnalysis) {
      const recList = Array.isArray(recommendationAnalysis) ? recommendationAnalysis : [];
      const workloadRecommendations = recList.filter(
        item => 
          item.workload_namespace === stat.namespace &&
          item.workload_name === stat.name
      );

      if (workloadRecommendations.length > 0) {
        const podCurrentTotals = new Map<string, { cpu: number; memory: number }>();
        const podRecommendedTotals = new Map<string, { cpu: number; memory: number }>();

        for (const item of workloadRecommendations) {
          const podKey = item.pod_name;
          
          const currentExisting = podCurrentTotals.get(podKey) || { cpu: 0, memory: 0 };
          currentExisting.cpu += item.current_requested_cpu;
          currentExisting.memory += item.current_requested_memory;
          podCurrentTotals.set(podKey, currentExisting);

          const recommendedExisting = podRecommendedTotals.get(podKey) || { cpu: 0, memory: 0 };
          recommendedExisting.cpu += item.recommended_cpu;
          recommendedExisting.memory += item.recommended_memory;
          podRecommendedTotals.set(podKey, recommendedExisting);
        }

        for (const [podKey, currentPod] of podCurrentTotals) {
          const recommendedPod = podRecommendedTotals.get(podKey) || { cpu: 0, memory: 0 };
          workloadTotalCurrentCpu += currentPod.cpu;
          workloadTotalCurrentMemory += currentPod.memory;
          workloadTotalRecommendedCpu += recommendedPod.cpu;
          workloadTotalRecommendedMemory += recommendedPod.memory;
          const podCpuDiff = currentPod.cpu > recommendedPod.cpu ? currentPod.cpu - recommendedPod.cpu : 0;
          const podMemDiff = currentPod.memory > recommendedPod.memory ? currentPod.memory - recommendedPod.memory : 0;
          potentialCpuDiff += podCpuDiff;
          potentialMemoryDiff += podMemDiff;
        }
      } else {
        workloadTotalCurrentCpu = workloadCurrentCpu;
        workloadTotalCurrentMemory = workloadCurrentMemory;
        workloadTotalRecommendedCpu = workloadRecommendedCpu;
        workloadTotalRecommendedMemory = workloadRecommendedMemory;
        potentialCpuDiff = workloadCurrentCpu > workloadRecommendedCpu ? workloadCurrentCpu - workloadRecommendedCpu : 0;
        potentialMemoryDiff = workloadCurrentMemory > workloadRecommendedMemory ? workloadCurrentMemory - workloadRecommendedMemory : 0;
      }
    } else {
      workloadTotalCurrentCpu = workloadCurrentCpu;
      workloadTotalCurrentMemory = workloadCurrentMemory;
      workloadTotalRecommendedCpu = workloadRecommendedCpu;
      workloadTotalRecommendedMemory = workloadRecommendedMemory;
      potentialCpuDiff = workloadCurrentCpu > workloadRecommendedCpu ? workloadCurrentCpu - workloadRecommendedCpu : 0;
      potentialMemoryDiff = workloadCurrentMemory > workloadRecommendedMemory ? workloadCurrentMemory - workloadRecommendedMemory : 0;
    }

    if (workloadTotalRecommendedCpu > workloadTotalCurrentCpu || workloadTotalRecommendedMemory > workloadTotalCurrentMemory) {
      reliabilityIssues++;
    }

    if (workloadTotalRecommendedCpu < workloadTotalCurrentCpu || workloadTotalRecommendedMemory < workloadTotalCurrentMemory) {
      costOptimizedWorkloads++;
    }

    const potentialMemoryGB = potentialMemoryDiff / 1024;

    totalPotentialCpu += potentialCpuDiff;
    totalPotentialMemory += potentialMemoryGB;

    if (enabled) {
      totalRealizedCpu += potentialCpuDiff;
      totalRealizedMemory += potentialMemoryGB;
    }
  }

  const avgWaste = wastePercentages.length > 0
    ? wastePercentages.reduce((sum, w) => sum + w, 0) / wastePercentages.length
    : 0;
  const optimizationScore = Math.max(0, Math.round(100 - avgWaste));

  const coverage = Math.round((workloadsWithRecommendations / stats.length) * 100);

  const potentialDollars = calculateDollarSavings(totalPotentialCpu, totalPotentialMemory);
  const realizedDollars = calculateDollarSavings(totalRealizedCpu, totalRealizedMemory);

  return {
    optimizationScore,
    coverage,
    potentialSavings: {
      cpu: Math.round(totalPotentialCpu * 10) / 10,
      memory: Math.round(totalPotentialMemory * 10) / 10,
      dollars: potentialDollars,
    },
    realizedSavings: {
      cpu: Math.round(totalRealizedCpu * 10) / 10,
      memory: Math.round(totalRealizedMemory * 10) / 10,
      dollars: realizedDollars,
    },
    reliabilityIssues,
    costOptimizedWorkloads,
    totalSavedPerHour: realizedDollars,
    realizedDollars,
    unrealizedDollars: potentialDollars - realizedDollars,
  };
}

export function transformStatsToWastefulWorkloads(
  statsResponse: StatsResponse,
  overrides: WorkloadOverrideInfo[] = [],
  limit: number = 10,
  recommendationAnalysis?: RecommendationAnalysisItem[]
): WastefulWorkload[] {
  const stats = Array.isArray(statsResponse?.stats) ? statsResponse.stats : [];
  const overrideList = Array.isArray(overrides) ? overrides : [];
  const overrideMap = new Map(overrideList.map(o => [o.workload_id, o]));
  const recommendationMap = recommendationAnalysis ? buildRecommendationMap(recommendationAnalysis) : undefined;
  
  const workloadData = stats.map(stat => {
    const workloadId = stat.workload;
    const override = overrideMap.get(workloadId);

    let workloadCurrentCpu = 0;
    let workloadRecommendedCpu = 0;
    let workloadCurrentMemory = 0;
    let workloadRecommendedMemory = 0;
    let hasRecommendations = false;

    const wastefulContainerStats = Array.isArray(stat.container_stats) ? stat.container_stats : [];
    const wastefulOriginalResources = Array.isArray(stat.original_container_resources) ? stat.original_container_resources : [];
    for (const containerStat of wastefulContainerStats) {
      const originalResource = wastefulOriginalResources.find(
        r => r.name === containerStat.container_name
      );

      if (!originalResource) continue;

      const currentCpu = originalResource.cpu_request || 0;
      const currentMemory = originalResource.memory_request || 0;
      const recommendedCpuArray = calculateRecommendedCpu(containerStat, stat.namespace, stat.name, currentCpu, recommendationMap);
      const recommendedMemoryArray = calculateRecommendedMemory(containerStat, stat.namespace, stat.name, currentMemory, recommendationMap);

      if (recommendedCpuArray.some(cpu => cpu > 0) || recommendedMemoryArray.some(mem => mem > 0)) {
        hasRecommendations = true;
      }

      if (containerStat.container_type === ContainerType.SIDECAR_CONTAINER || containerStat.container_type === ContainerType.APP_CONTAINER) {
        workloadCurrentCpu += currentCpu;
        workloadRecommendedCpu += recommendedCpuArray.reduce((sum, cpu) => sum + cpu, 0);
        workloadCurrentMemory += currentMemory;
        workloadRecommendedMemory += recommendedMemoryArray.reduce((sum, mem) => sum + mem, 0);
      } else if (containerStat.container_type === ContainerType.INIT_CONTAINER) {
        workloadCurrentCpu = Math.max(workloadCurrentCpu, currentCpu);
        workloadRecommendedCpu = Math.max(workloadRecommendedCpu, Math.max(...recommendedCpuArray));
        workloadCurrentMemory = Math.max(workloadCurrentMemory, currentMemory);
        workloadRecommendedMemory = Math.max(workloadRecommendedMemory, Math.max(...recommendedMemoryArray));
      }
    }

    let potentialCpuDiff = 0;
    let potentialMemoryDiff = 0;

    if (recommendationAnalysis) {
      const recList = Array.isArray(recommendationAnalysis) ? recommendationAnalysis : [];
      const workloadRecommendations = recList.filter(
        item => 
          item.workload_namespace === stat.namespace &&
          item.workload_name === stat.name
      );

      if (workloadRecommendations.length > 0) {
        const podCurrentTotals = new Map<string, { cpu: number; memory: number }>();
        const podRecommendedTotals = new Map<string, { cpu: number; memory: number }>();

        for (const item of workloadRecommendations) {
          const podKey = item.pod_name;
          
          const currentExisting = podCurrentTotals.get(podKey) || { cpu: 0, memory: 0 };
          currentExisting.cpu += item.current_requested_cpu;
          currentExisting.memory += item.current_requested_memory;
          podCurrentTotals.set(podKey, currentExisting);

          const recommendedExisting = podRecommendedTotals.get(podKey) || { cpu: 0, memory: 0 };
          recommendedExisting.cpu += item.recommended_cpu;
          recommendedExisting.memory += item.recommended_memory;
          podRecommendedTotals.set(podKey, recommendedExisting);
        }

        for (const [podKey, currentPod] of podCurrentTotals) {
          const recommendedPod = podRecommendedTotals.get(podKey) || { cpu: 0, memory: 0 };
          const podCpuDiff = currentPod.cpu > recommendedPod.cpu ? currentPod.cpu - recommendedPod.cpu : 0;
          const podMemDiff = currentPod.memory > recommendedPod.memory ? currentPod.memory - recommendedPod.memory : 0;
          potentialCpuDiff += podCpuDiff;
          potentialMemoryDiff += podMemDiff;
        }
      } else {
        potentialCpuDiff = workloadCurrentCpu > workloadRecommendedCpu ? workloadCurrentCpu - workloadRecommendedCpu : 0;
        potentialMemoryDiff = workloadCurrentMemory > workloadRecommendedMemory ? workloadCurrentMemory - workloadRecommendedMemory : 0;
      }
    } else {
      potentialCpuDiff = workloadCurrentCpu > workloadRecommendedCpu ? workloadCurrentCpu - workloadRecommendedCpu : 0;
      potentialMemoryDiff = workloadCurrentMemory > workloadRecommendedMemory ? workloadCurrentMemory - workloadRecommendedMemory : 0;
    }

    const potentialMemoryGB = potentialMemoryDiff / 1024;
    const savingsPerHour = calculateDollarSavings(potentialCpuDiff, potentialMemoryGB);

    const statContainers = Array.isArray(stat.container_stats) ? stat.container_stats : [];
    const containers = statContainers.filter(cs => cs.container_type === ContainerType.SIDECAR_CONTAINER || cs.container_type === ContainerType.APP_CONTAINER).length;

    return {
      namespace: stat.namespace,
      workload: stat.name,
      containers,
      savingsPerHour,
      type: stat.kind,
      hasRecommendations,
    };
  });

  return workloadData
    .filter(w => w.hasRecommendations)
    .sort((a, b) => b.savingsPerHour - a.savingsPerHour)
    .slice(0, limit)
    .map(({ hasRecommendations: _, ...rest }) => rest);
}

export function getContainerRecommendationsForWorkload(
  analysis: RecommendationAnalysisItem[],
  namespace: string,
  workloadName: string
): RecommendationAnalysisItem[] {
  const items = Array.isArray(analysis) ? analysis : [];
  return items.filter(
    item => item.workload_namespace === namespace && item.workload_name === workloadName
  );
}

export function getPodRecommendationsForContainer(
  analysis: RecommendationAnalysisItem[],
  containerName: string
): FrontendPodRecommendation[] {
  const items = Array.isArray(analysis) ? analysis : [];
  const filtered = items.filter(item => item.container_name === containerName);
  return transformRecommendationAnalysisToPodRecommendations(filtered);
}

export function getPodsForWorkload(
  analysis: RecommendationAnalysisItem[],
  namespace: string,
  workloadName: string
): string[] {
  const items = Array.isArray(analysis) ? analysis : [];
  const pods = new Set<string>();
  for (const item of items) {
    if (item.workload_namespace === namespace && item.workload_name === workloadName) {
      pods.add(item.pod_name);
    }
  }
  return Array.from(pods).sort();
}

export function getContainersForPod(
  analysis: RecommendationAnalysisItem[],
  podName: string
): FrontendContainerRecommendation[] {
  const items = Array.isArray(analysis) ? analysis : [];
  const filtered = items.filter(item => item.pod_name === podName);
  const containerMap = new Map<string, RecommendationAnalysisItem>();
  
  for (const item of filtered) {
    if (!containerMap.has(item.container_name)) {
      containerMap.set(item.container_name, item);
    }
  }
  
  return Array.from(containerMap.values()).map(item => ({
    container: item.container_name,
    cpuRequest: formatCpu(item.current_requested_cpu),
    cpuRecRequest: formatCpu(item.recommended_cpu),
    memRequest: formatMemory(item.current_requested_memory),
    memRecRequest: formatMemory(item.recommended_memory),
  }));
}


import {
  StatsResponse,
  WorkloadStat,
  ContainerStats,
  RecommendationAnalysisItem,
  RecommendationAnalysisResponse,
  WorkloadOverrideInfo,
  EXCLUDED_CODES,
  EXCLUDED_CODE_LABELS,
} from './api';
import { getCpuPricePerCorePerHour, getMemoryPricePerGbPerHour } from './pricing';

export interface FrontendWorkload {
  id: string;
  namespace: string;
  workload: string;
  type: string;
  /** Pod (replica) count for this workload */
  replicas: number;
  /** Potential CPU savings in cores (negative = can reduce, positive = need more). */
  potentialCpu: number;
  /** Potential memory savings in MB (negative = can reduce, positive = need more). */
  potentialMem: number;
  currentCpu: string;
  recommendedCpu: string;
  currentMem: string;
  recommendedMem: string;
  potentialDollars: number;
  /** Monthly cost of increasing resources when recommended > current (reliability). */
  reliabilityCostDollars: number;
  lastUpdated: string;
  mode: 'enabled' | 'recommend-only';
  priority: 'low' | 'medium' | 'high' | 'non-evictable';
  hasRecommendations: boolean;
  /** Disruption windows (cron in UTC) from overrides. */
  disruptionWindows: { startCron: string; endCron: string }[];
  /** True when workload is excluded from optimization; reason in excludedReason. */
  excluded?: boolean;
  excludedReason?: string;
  /** True when this workload blocks node consolidation (e.g. PDB or do-not-disrupt). */
  blockingConsolidation?: boolean;
  /** Reason: has PDB. */
  blockingConsolidationPdb?: boolean;
  /** Reason: has do-not-disrupt annotation. */
  blockingConsolidationDoNotDisrupt?: boolean;
  /** True when the workload is currently inside an active disruption window. */
  inDisruptionWindow?: boolean;
  /** True when the workload is identified as a GPU workload. */
  isGpuWorkload?: boolean;
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

/** Must match backend pkg/types/stats.go: EvictionRankingDisabled=1, Low=2, Medium=3, High=4 */
export enum EvictionRanking {
  EvictionRankingDisabled = 1,
  EvictionRankingLow = 2,
  EvictionRankingMedium = 3,
  EvictionRankingHigh = 4,
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

export interface WastefulWorkload {
  namespace: string;
  workload: string;
  containers: number;
  savingsPerHour: number;
  type: string;
}

export function formatCpu(cores: number): string {
  if (cores < 1) {
    return `${Math.round(cores * 1000)}m`;
  }
  return `${cores.toFixed(1)} cores`;
}

export function formatMemory(mb: number): string {
  if (mb < 1024) {
    return `${Math.round(mb)}Mi`;
  }
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Format CPU for display with sign: positive → "+500m", negative → "-500m", zero → "0m". */
export function formatCpuSigned(cores: number): string {
  if (cores === 0) return "0m";
  if (cores < 0) return `-${formatCpu(-cores)}`;
  return `+${formatCpu(cores)}`;
}

/** Format memory for display with sign: positive → "+256Mi", negative → "-256Mi", zero → "0Mi". */
export function formatMemorySigned(mb: number): string {
  if (mb === 0) return "0Mi";
  if (mb < 0) return `-${formatMemory(-mb)}`;
  return `+${formatMemory(mb)}`;
}

function formatCpuRange(min: number, max: number): string {
  return `${formatCpu(min)}-${formatCpu(max)}`;
}

function formatMemoryRange(min: number, max: number): string {
  return `${formatMemory(min)}-${formatMemory(max)}`;
}

export type RecommendationMap = Map<string, { cpu: number[]; memory: number[] }>;

export function buildRecommendationMap(analysis: RecommendationAnalysisItem[]): RecommendationMap {
  /** Map key: "namespace:workload:container"; value: arrays of recommended CPU and memory per container. */
  const map = new Map<string, { cpu: number[]; memory: number[] }>();
  const items = Array.isArray(analysis) ? analysis : [];
  for (const item of items) {
    /** Composite key for this container's recommendations. */
    const key = `${item.workload_namespace}:${item.workload_name}:${item.container_name}`;
    /** Existing entry for this key (multiple pods can share the same container name). */
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

export function mapEvictionRankingToPriority(ranking: number): 'high' | 'medium' | 'low' | 'non-evictable' {
  switch (Number(ranking)) {
    case EvictionRanking.EvictionRankingDisabled:
      return 'non-evictable';
    case EvictionRanking.EvictionRankingLow:
      return 'low';
    case EvictionRanking.EvictionRankingMedium:
      return 'medium';
    case EvictionRanking.EvictionRankingHigh:
      return 'high';
    default:
      return 'medium';
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

/** Monthly cost (or savings) from CPU cores + memory GB. Used for current cost and savings. */
export function calculateDollarSavings(cpuCores: number, memoryGB: number): number {
  const hoursPerMonth = 720;
  const cpuPrice = getCpuPricePerCorePerHour();
  const memoryPrice = getMemoryPricePerGbPerHour();
  return Math.round((cpuCores * cpuPrice + memoryGB * memoryPrice) * hoursPerMonth * 100) / 100;
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
  /** Composite workload id (e.g. namespace/name). */
  const workloadId = stat.workload;

  /** Sum of current CPU (cores) and memory (MB) across app/sidecar containers; max for init. */
  let totalCurrentCpu = 0;
  let totalCurrentMemory = 0;
  /** True if any container has a CPU or memory recommendation. */
  let hasRecommendations = false;

  /** Lookup by "namespace:workload:container" for recommended CPU/memory from analysis. */
  const recommendationMap = recommendationAnalysis ? buildRecommendationMap(recommendationAnalysis) : undefined;
  /** This workload's container stats and original resource requests. */
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
  /** Max recommended memory (MB) across pods for display. */
  let totalRecommendedMemory = 0;
  /** Sum of (current − recommended) for down-size; potential savings in CPU cores and memory MB. */
  let totalPotentialCpuDiff = 0;
  let totalPotentialMemoryDiff = 0;
  /** Sum of (recommended − current) for up-size; reliability cost in CPU cores and memory MB. */
  let totalReliabilityCpuDiff = 0;
  let totalReliabilityMemoryDiffMB = 0;

  const analysisList = Array.isArray(recommendationAnalysis) ? recommendationAnalysis : [];
  if (analysisList.length > 0) {
    /** Analysis items for this workload (namespace + name match). */
    const workloadRecommendations = analysisList.filter(
      item => 
        item.workload_namespace === stat.namespace &&
        item.workload_name === stat.name
    );

    if (workloadRecommendations.length > 0) {
      /** Per-pod current requested CPU (cores) and memory (MB). */
      const podCurrentTotals = new Map<string, { cpu: number; memory: number }>();
      /** Per-pod recommended CPU (cores) and memory (MB). */
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
        const podCpuDiff = currentPod.cpu - recommendedPod.cpu;
        const podMemDiff = currentPod.memory - recommendedPod.memory;
        totalPotentialCpuDiff += podCpuDiff;
        totalPotentialMemoryDiff += podMemDiff;
        totalReliabilityCpuDiff += recommendedPod.cpu > currentPod.cpu ? recommendedPod.cpu - currentPod.cpu : 0;
        totalReliabilityMemoryDiffMB += recommendedPod.memory > currentPod.memory ? recommendedPod.memory - currentPod.memory : 0;
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
  const potentialDollars = calculateDollarSavings(Math.max(0, totalPotentialCpuDiff), Math.max(0, potentialMemoryGB));
  const reliabilityMemoryGB = totalReliabilityMemoryDiffMB / 1024;
  const reliabilityCostDollars = calculateDollarSavings(totalReliabilityCpuDiff, reliabilityMemoryGB);

  const enabled = !override?.overrides ? true : override.overrides.enabled;
  const evictionRanking = override?.overrides?.eviction_ranking ?? stat.eviction_ranking;
  const rawWindows = override?.overrides?.disruption_windows ?? [];
  const disruptionWindows = rawWindows.map((w) => ({ startCron: w.start_cron, endCron: w.end_cron }));

  return {
    id: workloadId,
    namespace: stat.namespace,
    workload: stat.name,
    type: stat.kind,
    replicas: stat.replicas ?? 0,
    potentialCpu: -totalPotentialCpuDiff,
    potentialMem: -totalPotentialMemoryDiff,
    currentCpu: formatCpu(totalCurrentCpu),
    recommendedCpu,
    currentMem: formatMemory(totalCurrentMemory),
    recommendedMem,
    potentialDollars,
    reliabilityCostDollars,
    lastUpdated: formatTimeAgo(stat.updated_at),
    mode: enabled ? 'enabled' : 'recommend-only',
    priority: mapEvictionRankingToPriority(evictionRanking),
    hasRecommendations,
    disruptionWindows,
    excluded: stat.metadata?.excluded ?? false,
    excludedReason:
      Array.isArray(stat.metadata?.excluded_codes) && stat.metadata.excluded_codes.length > 0
        ? stat.metadata.excluded_codes
            .map((code) => EXCLUDED_CODE_LABELS[code] ?? code)
            .join(", ")
        : undefined,
  };
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

export function transformStatsToWastefulWorkloads(
  statsResponse: StatsResponse,
  overrides: WorkloadOverrideInfo[] = [],
  limit: number = 10,
  recommendationAnalysis?: RecommendationAnalysisItem[]
): WastefulWorkload[] {
  const stats = Array.isArray(statsResponse?.stats) ? statsResponse.stats : [];
  /** Normalized overrides; lookup by workload_id for continuous_optimization. */
  const overrideList = Array.isArray(overrides) ? overrides : [];
  const overrideMap = new Map(overrideList.map(o => [o.workload_id, o]));
  /** Lookup by "namespace:workload:container" for recommended CPU/memory. */
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
      /** Recommendation analysis items for this workload (namespace + name match). */
      const workloadRecommendations = recList.filter(
        item => 
          item.workload_namespace === stat.namespace &&
          item.workload_name === stat.name
      );

      if (workloadRecommendations.length > 0) {
        /** Per-pod current requested CPU (cores) and memory (MB) from analysis. */
        const podCurrentTotals = new Map<string, { cpu: number; memory: number }>();
        /** Per-pod recommended CPU (cores) and memory (MB) from analysis. */
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

export function getNodeNameForPod(
  analysis: RecommendationAnalysisItem[],
  podName: string
): string | undefined {
  const items = Array.isArray(analysis) ? analysis : [];
  const item = items.find((i) => i.pod_name === podName);
  return item?.node_name;
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


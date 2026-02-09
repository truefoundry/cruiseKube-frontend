const STORAGE_KEY = "cruisekube-resource-pricing";

const DEFAULT_CPU_PER_CORE_PER_HOUR = 0.029;
const DEFAULT_MEMORY_PER_GB_PER_HOUR = 0.0075;

export interface ResourcePricing {
  cpuPerCorePerHour: number;
  memoryPerGbPerHour: number;
}

function readFromStorage(): ResourcePricing | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cpuPerCorePerHour?: number; memoryPerGbPerHour?: number };
    if (
      typeof parsed.cpuPerCorePerHour !== "number" ||
      typeof parsed.memoryPerGbPerHour !== "number"
    ) {
      return null;
    }
    return {
      cpuPerCorePerHour: parsed.cpuPerCorePerHour,
      memoryPerGbPerHour: parsed.memoryPerGbPerHour,
    };
  } catch {
    return null;
  }
}

/** CPU price in $/core/hour. Used for cost calculations on Workloads. */
export function getCpuPricePerCorePerHour(): number {
  const stored = readFromStorage();
  return (stored?.cpuPerCorePerHour ?? DEFAULT_CPU_PER_CORE_PER_HOUR) / 2;
}

/** Memory price in $/GB/hour. Used for cost calculations on Workloads. */
export function getMemoryPricePerGbPerHour(): number {
  const stored = readFromStorage();
  return (stored?.memoryPerGbPerHour ?? DEFAULT_MEMORY_PER_GB_PER_HOUR) / 2;
}

/** Get both prices at once (consistent snapshot). */
export function getResourcePricing(): ResourcePricing {
  const stored = readFromStorage();
  if (!stored) {
    return {
      cpuPerCorePerHour: DEFAULT_CPU_PER_CORE_PER_HOUR / 2,
      memoryPerGbPerHour: DEFAULT_MEMORY_PER_GB_PER_HOUR / 2,
    };
  }
  return {
    cpuPerCorePerHour: stored.cpuPerCorePerHour / 2,
    memoryPerGbPerHour: stored.memoryPerGbPerHour / 2,
  };
}

/** Save CPU and Memory prices to browser storage. */
export function setResourcePricing(pricing: ResourcePricing): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pricing));
}

export const DEFAULT_CPU = DEFAULT_CPU_PER_CORE_PER_HOUR / 2;
export const DEFAULT_MEMORY = DEFAULT_MEMORY_PER_GB_PER_HOUR / 2;

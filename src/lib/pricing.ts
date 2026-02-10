const STORAGE_KEY = "cruisekube-resource-pricing";

const DEFAULT_CPU_PER_CORE_PER_HOUR = 0.029;
const DEFAULT_MEMORY_PER_GB_PER_HOUR = 0.0145;

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

/** The reason to divide by 2 is 

Let's say you are using 50% of on-demand and 50% of spot linux `c5a.xlarge` instance type, with 4 vCPUs and 8GB of memory. 

As per https://instances.vantage.sh/aws/ec2/c5a.xlarge?currency=USD, 
the price of the on-demand instance is $0.154/hour and the price of the spot instance is $0.078/hour.

So the average price of the instance is ($0.154 + $0.078) / 2 = $0.116/hour.

From their, we reach to price per core/hour and price per GB/hour by dividing by 4 and 8 respectively. 
So, the price per core/hour is $0.116/4 = $0.029/hour.
And the price per GB/hour is $0.116/8 = $0.0145/hour.

Here we assume that half of the price is for CPUs, and half is for memory. 

So, the price per core/hour and price per GB/hour are divided by 2.
price per core/hour = $0.029/2 = $0.0145/hour
price per GB/hour = $0.0145/2 = $0.00725/hour
 
 */
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

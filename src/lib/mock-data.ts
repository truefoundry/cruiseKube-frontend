// Mock data for the CruiseKube dashboard

export const overviewMetrics = {
  optimizationScore: 73,
  coverage: 85,
  potentialSavings: {
    cpu: 24.5,
    memory: 32.8,
    dollars: 245,
  },
  realizedSavings: {
    cpu: 18.2,
    memory: 25.1,
    dollars: 189,
  },
  reliabilityIssues: 12,
  reliabilityIncreaseCost: { cpu: 2.5, memory: 4.2, dollars: 85 },
  totalSavedPerHour: 189,
};

export const wastefulWorkloads = [
  { namespace: "production", workload: "api-gateway", containers: 3, wastePercent: 67, savingsPerHour: 45, type: "Deployment" },
  { namespace: "production", workload: "user-service", containers: 2, wastePercent: 58, savingsPerHour: 38, type: "Deployment" },
  { namespace: "staging", workload: "data-processor", containers: 4, wastePercent: 52, savingsPerHour: 32, type: "StatefulSet" },
  { namespace: "development", workload: "test-runner", containers: 1, wastePercent: 48, savingsPerHour: 28, type: "Job" },
  { namespace: "production", workload: "cache-service", containers: 2, wastePercent: 45, savingsPerHour: 25, type: "Deployment" },
  { namespace: "monitoring", workload: "prometheus", containers: 1, wastePercent: 42, savingsPerHour: 22, type: "StatefulSet" },
  { namespace: "production", workload: "auth-service", containers: 2, wastePercent: 38, savingsPerHour: 19, type: "Deployment" },
  { namespace: "staging", workload: "web-frontend", containers: 1, wastePercent: 35, savingsPerHour: 17, type: "Deployment" },
  { namespace: "production", workload: "notification-svc", containers: 2, wastePercent: 32, savingsPerHour: 15, type: "Deployment" },
  { namespace: "development", workload: "debug-tools", containers: 3, wastePercent: 28, savingsPerHour: 12, type: "DaemonSet" },
];

export const leaderboard = [
  { namespace: "production", realizedSavings: 5200, remainingPotential: 1800 },
  { namespace: "staging", realizedSavings: 2100, remainingPotential: 900 },
  { namespace: "development", realizedSavings: 1500, remainingPotential: 1200 },
  { namespace: "monitoring", realizedSavings: 890, remainingPotential: 450 },
  { namespace: "kube-system", realizedSavings: 650, remainingPotential: 320 },
];

export const historicSavings = [
  { date: "Dec 1", realized: 1200, potential: 1800 },
  { date: "Dec 2", realized: 1350, potential: 1750 },
  { date: "Dec 3", realized: 1420, potential: 1700 },
  { date: "Dec 4", realized: 1580, potential: 1650 },
  { date: "Dec 5", realized: 1650, potential: 1620 },
  { date: "Dec 6", realized: 1720, potential: 1580 },
  { date: "Dec 7", realized: 1890, potential: 1520 },
];

export const workloads = [
  { 
    id: "1",
    namespace: "production", 
    workload: "api-gateway", 
    type: "Deployment",
    wastePercent: 67, 
    potentialCpu: -2.4,
    potentialMem: -(4.2 * 1024),
    potentialDollars: 450,
    lastUpdated: "2 min ago",
    mode: "enabled",
    priority: "high",
    hasRecommendations: true,
  },
  { 
    id: "2",
    namespace: "production", 
    workload: "user-service", 
    type: "Deployment",
    wastePercent: 58, 
    potentialCpu: -1.8,
    potentialMem: -(3.1 * 1024),
    potentialDollars: 380,
    lastUpdated: "5 min ago",
    mode: "enabled",
    priority: "high",
    hasRecommendations: true,
  },
  { 
    id: "3",
    namespace: "staging", 
    workload: "data-processor", 
    type: "StatefulSet",
    wastePercent: 52, 
    potentialCpu: -3.2,
    potentialMem: -(6.4 * 1024),
    potentialDollars: 320,
    lastUpdated: "12 min ago",
    mode: "recommend-only",
    priority: "medium",
    hasRecommendations: true,
  },
  { 
    id: "4",
    namespace: "development", 
    workload: "test-runner", 
    type: "Job",
    wastePercent: 48, 
    potentialCpu: -0.8,
    potentialMem: -(1.2 * 1024),
    potentialDollars: 280,
    lastUpdated: "1 hr ago",
    mode: "recommend-only",
    priority: "low",
    hasRecommendations: true,
  },
  { 
    id: "5",
    namespace: "production", 
    workload: "cache-service", 
    type: "Deployment",
    wastePercent: 45, 
    potentialCpu: -1.2,
    potentialMem: -(8.5 * 1024),
    potentialDollars: 250,
    lastUpdated: "3 min ago",
    mode: "enabled",
    priority: "high",
    hasRecommendations: true,
  },
  { 
    id: "6",
    namespace: "monitoring", 
    workload: "prometheus", 
    type: "StatefulSet",
    wastePercent: 42, 
    potentialCpu: -0.6,
    potentialMem: -(2.1 * 1024),
    potentialDollars: 220,
    lastUpdated: "8 min ago",
    mode: "enabled",
    priority: "non-evictable",
    hasRecommendations: false,
  },
  { 
    id: "7",
    namespace: "production", 
    workload: "auth-service", 
    type: "Deployment",
    wastePercent: 38, 
    potentialCpu: -0.9,
    potentialMem: -(1.8 * 1024),
    potentialDollars: 190,
    lastUpdated: "15 min ago",
    mode: "enabled",
    priority: "high",
    hasRecommendations: true,
  },
  { 
    id: "8",
    namespace: "staging", 
    workload: "web-frontend", 
    type: "Deployment",
    wastePercent: 35, 
    potentialCpu: -0.5,
    potentialMem: -(1.0 * 1024),
    potentialDollars: 170,
    lastUpdated: "22 min ago",
    mode: "recommend-only",
    priority: "medium",
    hasRecommendations: true,
  },
];

export const auditEvents = [
  { timestamp: "2024-12-08 14:32:15", type: "applied", workload: "api-gateway", container: "nginx", deltaCpu: "+200m", deltaMem: "-512Mi", pod: "api-gateway-7d8f9", node: "node-1" },
  { timestamp: "2024-12-08 14:28:42", type: "recommendation", workload: "user-service", container: "app", deltaCpu: "-100m", deltaMem: "-256Mi", pod: "user-service-4c5d6", node: "node-2" },
  { timestamp: "2024-12-08 14:15:33", type: "ignored", workload: "cache-service", container: "redis", deltaCpu: "-50m", deltaMem: "+128Mi", pod: "cache-service-8e9f0", node: "node-1" },
  { timestamp: "2024-12-08 13:58:21", type: "evicted", workload: "data-processor", container: "worker", deltaCpu: "N/A", deltaMem: "N/A", pod: "data-processor-1a2b3", node: "node-3" },
  { timestamp: "2024-12-08 13:45:09", type: "applied", workload: "auth-service", container: "main", deltaCpu: "-150m", deltaMem: "-384Mi", pod: "auth-service-5d6e7", node: "node-2" },
  { timestamp: "2024-12-08 13:32:55", type: "recommendation", workload: "web-frontend", container: "next", deltaCpu: "-80m", deltaMem: "-192Mi", pod: "web-frontend-9f0a1", node: "node-1" },
  { timestamp: "2024-12-08 13:18:44", type: "snoozed", workload: "prometheus", container: "server", deltaCpu: "-200m", deltaMem: "-1Gi", pod: "prometheus-0", node: "node-3" },
];

export const containers = [
  { name: "nginx", cpuCurrent: "500m", cpuRecommended: "200m-350m", memCurrent: "1Gi", memRecommended: "512Mi-768Mi", wastePercent: 58 },
  { name: "app", cpuCurrent: "1000m", cpuRecommended: "400m-600m", memCurrent: "2Gi", memRecommended: "1Gi-1.5Gi", wastePercent: 55 },
  { name: "sidecar", cpuCurrent: "200m", cpuRecommended: "50m-100m", memCurrent: "256Mi", memRecommended: "128Mi-192Mi", wastePercent: 62 },
];

export const podRecommendations = [
  { pod: "api-gateway-7d8f9a1b2c", cpuRequest: "500m", cpuLimit: "1000m", cpuRecRequest: "200m", cpuRecLimit: "400m", memRequest: "1Gi", memLimit: "2Gi", memRecRequest: "512Mi", memRecLimit: "1Gi", usageP99: "45%", usageP50: "22%" },
  { pod: "api-gateway-3d4e5f6g7h", cpuRequest: "500m", cpuLimit: "1000m", cpuRecRequest: "180m", cpuRecLimit: "360m", memRequest: "1Gi", memLimit: "2Gi", memRecRequest: "480Mi", memRecLimit: "960Mi", usageP99: "42%", usageP50: "18%" },
  { pod: "api-gateway-8i9j0k1l2m", cpuRequest: "500m", cpuLimit: "1000m", cpuRecRequest: "220m", cpuRecLimit: "440m", memRequest: "1Gi", memLimit: "2Gi", memRecRequest: "544Mi", memRecLimit: "1.1Gi", usageP99: "48%", usageP50: "25%" },
];

export const recommendationHistory = [
  { timestamp: "2024-12-08 14:32:15", oldCpu: "500m", newCpu: "200m", oldMem: "1Gi", newMem: "512Mi", decision: "applied", actor: "cruisekube" },
  { timestamp: "2024-12-07 10:15:42", oldCpu: "600m", newCpu: "500m", oldMem: "1.5Gi", newMem: "1Gi", decision: "applied", actor: "cruisekube" },
  { timestamp: "2024-12-06 08:22:33", oldCpu: "400m", newCpu: "350m", oldMem: "768Mi", newMem: "1Gi", decision: "ignored", actor: "user@company.com" },
  { timestamp: "2024-12-05 16:45:21", oldCpu: "800m", newCpu: "600m", oldMem: "2Gi", newMem: "1.5Gi", decision: "snoozed", actor: "user@company.com" },
];

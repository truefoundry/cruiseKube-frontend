import type {
  AuditEventsResponse,
  AuditEvent,
  ClusterSettings,
  ClustersResponse,
  HistoricalTimelineResponse,
  HistoricalTimelineDataPoint,
  LoginResponse,
  Overrides,
  OverviewResponse,
  PrometheusConfig,
  WorkloadDetail,
  WorkloadDetailResponse,
  WorkloadSummaryResponse,
} from "@/lib/api";
import { mapCriticalToEvictionRanking, mapEvictionRankingToCritical } from "@/lib/transformers";

export const DEMO_CLUSTER_ID = "demo-cluster";

const DEMO_DELAY_MS = 90;

async function delay(): Promise<void> {
  await new Promise((r) => setTimeout(r, DEMO_DELAY_MS));
}

function normalizeWorkloadId(id: string): string {
  return id.includes("/") ? id.replace(/\//g, ":") : id;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function baseWorkloadDetail(p: {
  workloadID: string;
  kind: string;
  namespace: string;
  name: string;
  cruiseEnabled: boolean;
  criticalityLevel: "low" | "medium" | "high" | "very-high";
  podsCount: number;
  dollarSavingsPerMonth: number;
  dollarExpenditurePerMonth: number;
  cpuCurrent: number;
  cpuAvg: number;
  cpuRecAvg: number;
  cpuChange: number;
  memCurrent: number;
  memAvg: number;
  memRecAvg: number;
  memChange: number;
  constraints?: Partial<WorkloadDetail["constraints"]>;
  config?: Partial<WorkloadDetail["config"]>;
}): WorkloadDetail {
  const now = Math.floor(Date.now() / 1000);
  return {
    workloadID: p.workloadID,
    kind: p.kind,
    namespace: p.namespace,
    name: p.name,
    updatedAt: now - 120,
    podsCount: p.podsCount,
    constraints: {
      blockingConsolidation: false,
      pdb: p.constraints?.pdb ?? false,
      doNotDisruptAnnotation: p.constraints?.doNotDisruptAnnotation ?? false,
      volume: false,
      affinity: false,
      topologySpreadConstraint: false,
      podAntiAffinity: false,
      excludedAnnotation: p.constraints?.excludedAnnotation ?? false,
      isGPUWorkload: p.constraints?.isGPUWorkload ?? false,
    },
    cpu: {
      current: p.cpuCurrent,
      pod_current_avg: p.cpuAvg,
      recommended: {
        min: p.cpuRecAvg * 0.85,
        max: p.cpuRecAvg * 1.1,
        avg: p.cpuRecAvg,
        change: p.cpuChange,
      },
    },
    memory: {
      current: p.memCurrent,
      pod_current_avg: p.memAvg,
      recommended: {
        min: p.memRecAvg * 0.85,
        max: p.memRecAvg * 1.1,
        avg: p.memRecAvg,
        change: p.memChange,
      },
    },
    dollarSavingsPerMonth: p.dollarSavingsPerMonth,
    dollarExpenditurePerMonth: p.dollarExpenditurePerMonth,
    config: {
      criticalityLevel: p.criticalityLevel,
      cruiseEnabled: p.cruiseEnabled,
      disruptionSchedule: [],
      inDisruptionWindow: false,
      hpaEnabled: p.config?.hpaEnabled ?? false,
      excludedCodes: p.config?.excludedCodes,
    },
  };
}

function workloadDetailToApiResponse(d: WorkloadDetail): WorkloadDetailResponse {
  const podName = `${d.name}-7d8f9a1b2c`;
  return {
    cluster: DEMO_CLUSTER_ID,
    namespace: d.namespace,
    workload: d.name,
    type: d.kind,
    current_cpu_request: d.cpu.current,
    current_cpu_limit: d.cpu.current * 2,
    current_mem_request: d.memory.current,
    current_mem_limit: d.memory.current * 2,
    current_pod_avg_cpu_request: d.cpu.pod_current_avg,
    current_pod_avg_mem_request: d.memory.pod_current_avg,
    potential_cpu_savings: -d.cpu.recommended.change,
    potential_mem_savings: -d.memory.recommended.change,
    pods: [
      {
        pod_name: podName,
        node_name: "demo-node-1",
        containers: [
          {
            container_name: "app",
            cpu_request: d.cpu.current / Math.max(1, d.podsCount),
            cpu_rec_request: d.cpu.recommended.avg / Math.max(1, d.podsCount),
            mem_request: d.memory.current / Math.max(1, d.podsCount),
            mem_rec_request: d.memory.recommended.avg / Math.max(1, d.podsCount),
          },
        ],
      },
    ],
  };
}

function seedSummary(): WorkloadSummaryResponse {
  const workloads: WorkloadDetail[] = [
    baseWorkloadDetail({
      workloadID: "Deployment:production:api-gateway",
      kind: "Deployment",
      namespace: "production",
      name: "api-gateway",
      cruiseEnabled: true,
      criticalityLevel: "high",
      podsCount: 3,
      dollarSavingsPerMonth: 450,
      dollarExpenditurePerMonth: 40,
      cpuCurrent: 1.5,
      cpuAvg: 0.45,
      cpuRecAvg: 0.55,
      cpuChange: -0.35,
      memCurrent: 3072,
      memAvg: 900,
      memRecAvg: 1536,
      memChange: -800,
    }),
    baseWorkloadDetail({
      workloadID: "Deployment:production:user-service",
      kind: "Deployment",
      namespace: "production",
      name: "user-service",
      cruiseEnabled: true,
      criticalityLevel: "high",
      podsCount: 2,
      dollarSavingsPerMonth: 320,
      dollarExpenditurePerMonth: 28,
      cpuCurrent: 2,
      cpuAvg: 0.6,
      cpuRecAvg: 0.9,
      cpuChange: -0.4,
      memCurrent: 4096,
      memAvg: 1200,
      memRecAvg: 2560,
      memChange: -900,
    }),
    baseWorkloadDetail({
      workloadID: "StatefulSet:staging:data-processor",
      kind: "StatefulSet",
      namespace: "staging",
      name: "data-processor",
      cruiseEnabled: false,
      criticalityLevel: "medium",
      podsCount: 4,
      dollarSavingsPerMonth: 280,
      dollarExpenditurePerMonth: 55,
      cpuCurrent: 4,
      cpuAvg: 1.2,
      cpuRecAvg: 2.5,
      cpuChange: -0.8,
      memCurrent: 8192,
      memAvg: 3000,
      memRecAvg: 6144,
      memChange: -1200,
    }),
    baseWorkloadDetail({
      workloadID: "StatefulSet:monitoring:prometheus",
      kind: "StatefulSet",
      namespace: "monitoring",
      name: "prometheus",
      cruiseEnabled: true,
      criticalityLevel: "very-high",
      podsCount: 1,
      dollarSavingsPerMonth: 0,
      dollarExpenditurePerMonth: 120,
      cpuCurrent: 2,
      cpuAvg: 1.1,
      cpuRecAvg: 1.8,
      cpuChange: 0,
      memCurrent: 8192,
      memAvg: 7000,
      memRecAvg: 8192,
      memChange: 0,
      constraints: { excludedAnnotation: true },
      config: { excludedCodes: ["INCOMPLETE_STATS"] },
    }),
    baseWorkloadDetail({
      workloadID: "Deployment:production:gpu-worker",
      kind: "Deployment",
      namespace: "production",
      name: "gpu-worker",
      cruiseEnabled: false,
      criticalityLevel: "medium",
      podsCount: 2,
      dollarSavingsPerMonth: 0,
      dollarExpenditurePerMonth: 200,
      cpuCurrent: 8,
      cpuAvg: 6,
      cpuRecAvg: 8,
      cpuChange: 0,
      memCurrent: 32768,
      memAvg: 28000,
      memRecAvg: 32768,
      memChange: 0,
      constraints: { isGPUWorkload: true },
      config: { excludedCodes: ["GPU_WORKLOAD"] },
    }),
  ];

  return {
    impactSummary: {
      dollarCurrentCost: 12500,
      dollarCurrentSavings: 1890,
      dollarPossibleSavings: 2450,
      clusterResources: {
        cpu: { utilised: 38, requested: 72, allocatable: 96 },
        memory: { utilised: 120, requested: 280, allocatable: 384 },
      },
    },
    workloadDetails: workloads,
  };
}

function seedOverview(): OverviewResponse {
  return {
    currentMonthlyCost: 11200,
    currentSavings: 1650,
    possibleSavings: 2300,
    clusterUtilisation: 62,
    nodeCount: 12,
    coverage: {
      adoption: {
        optimizable: 42,
        nonOptimizable: 18,
        optimizableButExcluded: 8,
        total: 68,
      },
      cpuCoverage: { enabled: 35, disabled: 33 },
      memoryCoverage: { enabled: 32, disabled: 36 },
    },
    cpuStats: {
      allocatable: 96,
      requested: 72,
      workloadRequested: 70,
      usage: 38,
      recommended: 48,
    },
    memoryStats: {
      allocatable: 384,
      requested: 280,
      workloadRequested: 275,
      usage: 120,
      recommended: 190,
    },
  };
}

function seedAuditEvents(): AuditEvent[] {
  const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
  return [
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "recommendation",
      category: "CPU_RECOMMENDATION_APPLIED",
      payload: {
        message: "CPU request updated",
        target: { kind: "Deployment", name: "api-gateway", namespace: "production" },
        details: { workloadId: "Deployment:production:api-gateway" },
      },
      created_at: iso(12),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "recommendation",
      category: "MEMORY_RECOMMENDATION_APPLIED",
      payload: {
        message: "Memory request updated",
        target: { kind: "Deployment", name: "user-service", namespace: "production" },
        details: { workloadId: "Deployment:production:user-service" },
      },
      created_at: iso(45),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "policy",
      category: "PDB_RELAXED",
      payload: {
        target: { kind: "StatefulSet", name: "data-processor", namespace: "staging" },
        details: { workloadId: "StatefulSet:staging:data-processor" },
      },
      created_at: iso(120),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "eviction",
      category: "POD_DISRUPTION_BLOCK_REMOVED",
      payload: {
        target: { kind: "Deployment", name: "api-gateway", namespace: "production" },
        details: { workloadId: "Deployment:production:api-gateway" },
      },
      created_at: iso(180),
    },
  ];
}

interface DemoState {
  summary: WorkloadSummaryResponse;
  overview: OverviewResponse;
  settings: ClusterSettings;
  auditEvents: AuditEvent[];
}

const state: DemoState = {
  summary: seedSummary(),
  overview: seedOverview(),
  settings: {
    cpuPricePerCorePerHour: 0.0145,
    memoryPricePerGBPerHour: 0.00724,
  },
  auditEvents: seedAuditEvents(),
};

function buildHistoricalTimeline(
  startTime: string,
  endTime: string,
  metric: "cpu" | "memory" | "cost"
): HistoricalTimelineResponse {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const span = Math.max(hi - lo, 60_000);
  const steps = 14;
  const data: HistoricalTimelineDataPoint[] = [];

  const series =
    metric === "cost"
      ? [
          { legend: "Monthly spend", color: "#6366f1" },
          { legend: "Allocation baseline", color: "#94a3b8" },
        ]
      : [
          { legend: "Requested", color: "#94a3b8" },
          { legend: "Usage", color: "#3b82f6" },
          { legend: "Recommended", color: "#a855f7" },
        ];

  for (let i = 0; i <= steps; i++) {
    const t = lo + (span * i) / steps;
    const iso = new Date(t).toISOString();
    let idx = 0;
    for (const { legend, color } of series) {
      const wobble = Math.sin(i * 0.45 + idx) * (metric === "cost" ? 8 : 0.04);
      const base =
        metric === "cost" ? 4200 + i * 35 + wobble : 0.55 + i * 0.015 + wobble;
      const value =
        metric === "cost"
          ? base * (legend.includes("Allocation") ? 0.92 : 1)
          : base * (legend === "Usage" ? 0.68 : legend === "Recommended" ? 0.78 : 1);
      data.push({
        legend,
        color,
        threshold: { value: 0, color: "#64748b" },
        data: { timestamp: iso, value: Math.max(0, value) },
      });
      idx += 1;
    }
  }
  return { data };
}

function findWorkloadIndex(workloadId: string): number {
  const id = normalizeWorkloadId(workloadId);
  return state.summary.workloadDetails.findIndex((w) => normalizeWorkloadId(w.workloadID) === id);
}

function asCriticality(s: string): "low" | "medium" | "high" | "very-high" {
  if (s === "low" || s === "medium" || s === "high" || s === "very-high") return s;
  return "medium";
}

function overridesFromDetail(d: WorkloadDetail): Overrides {
  const rank = mapCriticalToEvictionRanking(asCriticality(d.config.criticalityLevel));
  const windows = (d.config.disruptionSchedule ?? []).map((w) => ({
    start_cron: w.windowStartCron,
    end_cron: w.windowEndCron,
  }));
  const o: Overrides = {
    eviction_ranking: rank,
    enabled: d.config.cruiseEnabled,
  };
  if (windows.length > 0) o.disruption_windows = windows;
  return o;
}

function applyOverridesToDetail(d: WorkloadDetail, overrides: Overrides): WorkloadDetail {
  const next = clone(d);
  if (overrides.enabled !== undefined) {
    next.config = { ...next.config, cruiseEnabled: overrides.enabled };
  }
  if (overrides.eviction_ranking !== undefined) {
    next.config = {
      ...next.config,
      criticalityLevel: mapEvictionRankingToCritical(overrides.eviction_ranking),
    };
  }
  if (overrides.disruption_windows !== undefined) {
    next.config = {
      ...next.config,
      disruptionSchedule: overrides.disruption_windows.map((w) => ({
        windowStartCron: w.start_cron,
        windowEndCron: w.end_cron,
      })),
    };
  }
  return next;
}

export async function demoLogin(): Promise<LoginResponse> {
  await delay();
  return { token: btoa("demo:demo"), token_type: "Basic" };
}

export async function demoGetClusters(): Promise<ClustersResponse> {
  await delay();
  return clone({
    clusters: [
      {
        id: DEMO_CLUSTER_ID,
        name: "Demo cluster",
        stats_available: true,
      },
    ],
    count: 1,
    cluster_mode: "single",
  });
}

export async function demoGetWorkloadsSummary(clusterID: string): Promise<WorkloadSummaryResponse> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) {
    return clone({ impactSummary: state.summary.impactSummary, workloadDetails: [] });
  }
  return clone(state.summary);
}

export async function demoGetOverview(clusterID: string): Promise<OverviewResponse> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) return clone(seedOverview());
  return clone(state.overview);
}

export async function demoGetHistoricalTimeline(
  clusterID: string,
  metric: "cpu" | "memory" | "cost",
  startTime: string,
  endTime: string
): Promise<HistoricalTimelineResponse> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) return { data: [] };
  return clone(buildHistoricalTimeline(startTime, endTime, metric));
}

export async function demoGetWorkloadDetail(
  clusterID: string,
  namespace: string,
  workloadName: string
): Promise<WorkloadDetailResponse> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) {
    throw new Error("Cluster not found");
  }
  const w = state.summary.workloadDetails.find((x) => x.namespace === namespace && x.name === workloadName);
  if (!w) throw new Error("Workload not found");
  return clone(workloadDetailToApiResponse(w));
}

export async function demoGetConfig(clusterID: string): Promise<PrometheusConfig> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) {
    return { url: "", connected: false, error: "No cluster" };
  }
  return clone({
    url: "https://prometheus.demo.local",
    connected: true,
    version: "0.0.0-demo",
  });
}

export async function demoGetSettings(clusterID: string): Promise<ClusterSettings> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) {
    return clone({ cpuPricePerCorePerHour: 0.0145, memoryPricePerGBPerHour: 0.00724 });
  }
  return clone(state.settings);
}

export async function demoUpdateSettings(
  clusterID: string,
  settings: ClusterSettings
): Promise<ClusterSettings> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) return clone(settings);
  state.settings = { ...settings };
  return clone(state.settings);
}

export async function demoGetAuditEvents(
  clusterID: string,
  _minutes: number,
  workloadId?: string
): Promise<AuditEventsResponse> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) return { events: [] };
  let events = clone(state.auditEvents);
  const filter = workloadId?.trim();
  if (filter) {
    const f = normalizeWorkloadId(filter);
    events = events.filter((e) => {
      const fromDetails =
        e.payload?.details &&
        typeof e.payload.details === "object" &&
        typeof (e.payload.details as { workloadId?: string }).workloadId === "string"
          ? normalizeWorkloadId((e.payload.details as { workloadId: string }).workloadId)
          : "";
      const t = e.payload?.target;
      const synthetic =
        t?.kind && t?.namespace && t?.name
          ? normalizeWorkloadId(`${t.kind}:${t.namespace}:${t.name}`)
          : "";
      return fromDetails === f || synthetic === f;
    });
  }
  return { events };
}

export async function demoUpdateWorkloadOverrides(
  clusterID: string,
  workloadId: string,
  overrides: Overrides
): Promise<Overrides> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) throw new Error("Cluster not found");
  const idx = findWorkloadIndex(workloadId);
  if (idx < 0) throw new Error("Workload not found");
  const updated = applyOverridesToDetail(state.summary.workloadDetails[idx], overrides);
  state.summary.workloadDetails[idx] = updated;
  return overridesFromDetail(updated);
}

export async function demoBatchWorkloadOverrides(
  clusterID: string,
  workloadIds: string[],
  overrides: Overrides
): Promise<void> {
  await delay();
  if (clusterID !== DEMO_CLUSTER_ID) throw new Error("Cluster not found");
  for (const wid of workloadIds) {
    const idx = findWorkloadIndex(wid);
    if (idx >= 0) {
      state.summary.workloadDetails[idx] = applyOverridesToDetail(
        state.summary.workloadDetails[idx],
        overrides
      );
    }
  }
}

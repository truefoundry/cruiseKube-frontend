import type {
  AuditEventsResponse,
  AuditEvent,
  AuthInfoResponse,
  ClusterSettings,
  ClustersResponse,
  HistoricalTimelineResponse,
  LoginResponse,
  Overrides,
  OverviewResponse,
  PreflightResponse,
  PrometheusConfig,
  WorkloadDetail,
  WorkloadDetailResponse,
  WorkloadSummaryResponse,
} from "@/lib/api";
import {
  DEMO_OVERVIEW_CAPTURE,
  buildDemoCostTimelineData,
  buildDemoCpuTimelineData,
  buildDemoMemoryTimelineData,
  remapTimelineToWindow,
} from "@/lib/demo-overview-capture";
import { createDemoWorkloadSummary } from "@/lib/demo-workloads-summary";
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

function workloadDetailToApiResponse(d: WorkloadDetail): WorkloadDetailResponse {
  const perPod = Math.max(1, d.podsCount);
  const cpuReqPerPod = d.cpu.current / perPod;
  const memReqPerPod = d.memory.current / perPod;
  const cpuEffPerPod = d.cpu.pod_current_avg ?? d.cpu.podCurrentAvg;
  const memEffPerPod = d.memory.pod_current_avg ?? d.memory.podCurrentAvg;

  const podName = `${d.name}-7d8f9a1b2c`;
  const pods =
    d.podsCount === 0
      ? []
      : [
          {
            pod_name: podName,
            node_name: "demo-node-1",
            containers: [
              {
                container_name: "app",
                cpu_request: cpuReqPerPod,
                cpu_rec_request: d.cpu.recommended.avg / perPod,
                mem_request: memReqPerPod,
                mem_rec_request: d.memory.recommended.avg / perPod,
                ...(cpuEffPerPod != null && Math.abs(cpuEffPerPod - cpuReqPerPod) > 1e-9
                  ? { current_cpu_request: cpuEffPerPod }
                  : {}),
                ...(memEffPerPod != null && Math.abs(memEffPerPod - memReqPerPod) > 1e-9
                  ? { current_mem_request: memEffPerPod }
                  : {}),
              },
            ],
          },
        ];
  return {
    cluster: DEMO_CLUSTER_ID,
    namespace: d.namespace,
    workload: d.name,
    type: d.kind,
    current_cpu_request: d.cpu.current,
    current_cpu_limit: d.cpu.current * 2,
    current_mem_request: d.memory.current,
    current_mem_limit: d.memory.current * 2,
    current_pod_avg_cpu_request: cpuEffPerPod,
    current_pod_avg_mem_request: memEffPerPod,
    potential_cpu_savings: -d.cpu.recommended.change,
    potential_mem_savings: -d.memory.recommended.change,
    pods,
  };
}

function seedSummary(): WorkloadSummaryResponse {
  return clone(createDemoWorkloadSummary());
}

function seedOverview(): OverviewResponse {
  return clone(DEMO_OVERVIEW_CAPTURE);
}

function seedAuditEvents(): AuditEvent[] {
  const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
  return [
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "node",
      category: "NODE_OVERLOAD_TAINT_ADDED",
      payload: {
        message: "Taint node.cruisekube.io/overload=true added",
        target: { kind: "Node", name: "demo-node-1", namespace: "" },
        details: { nodeName: "demo-node-1", taint: "node.cruisekube.io/overload=true:NoSchedule" },
      },
      created_at: iso(6),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "recommendation",
      category: "CPU_RECOMMENDATION_APPLIED",
      payload: {
        message: "CPU request updated",
        target: { kind: "Deployment", name: "tfy-flyte-scheduler", namespace: "truefoundry" },
        details: {
          workloadId: "Deployment:truefoundry:tfy-flyte-scheduler",
          previousRequest: "1000m",
          newRequest: "1000m",
        },
      },
      created_at: iso(12),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "admission",
      category: "WEBHOOK_MUTATION",
      payload: {
        message: "Mutating webhook patched container resources",
        target: { kind: "Deployment", name: "tfy-flyte-scheduler", namespace: "truefoundry" },
        details: {
          workloadId: "Deployment:truefoundry:tfy-flyte-scheduler",
          webhook: "cruisekube-mutating-webhook",
          patches: ["spec.template.spec.containers[0].resources.requests.cpu"],
        },
      },
      created_at: iso(18),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "recommendation",
      category: "MEMORY_RECOMMENDATION_APPLIED",
      payload: {
        message: "Memory request updated",
        target: {
          kind: "Deployment",
          name: "tfy-llm-gateway-test-ask-user-qs",
          namespace: "pranjal-ws",
        },
        details: {
          workloadId: "Deployment:pranjal-ws:tfy-llm-gateway-test-ask-user-qs",
          previousRequestMi: 512,
          newRequestMi: 441,
        },
      },
      created_at: iso(45),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "eviction",
      category: "POD_EVICTION",
      payload: {
        message: "Pod evicted for consolidation",
        target: { kind: "Pod", name: "pdb-dnd-mitigated-xyz12", namespace: "demo-cases" },
        details: {
          workloadId: "Deployment:demo-cases:pdb-dnd-mitigated",
          reason: "PreemptionByScheduler",
          node: "demo-node-2",
        },
      },
      created_at: iso(52),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "workload",
      category: "OOM_EVENT",
      payload: {
        message: "OOMKilled reported for container app",
        target: { kind: "Pod", name: "batch-etl-abc12", namespace: "demo-cases" },
        details: {
          workloadId: "Job:demo-cases:batch-etl",
          container: "app",
          exitCode: 137,
          limitMi: 8192,
        },
      },
      created_at: iso(68),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "policy",
      category: "PDB_RELAXED",
      payload: {
        message: "PDB maxUnavailable raised for maintenance window",
        target: { kind: "Deployment", name: "pdb-dnd-mitigated", namespace: "demo-cases" },
        details: {
          workloadId: "Deployment:demo-cases:pdb-dnd-mitigated",
          pdbName: "pdb-dnd-mitigated-pdb",
          previousMaxUnavailable: 1,
          newMaxUnavailable: 2,
        },
      },
      created_at: iso(120),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "policy",
      category: "PDB_RESTORED",
      payload: {
        message: "PDB restored after maintenance",
        target: { kind: "Deployment", name: "pdb-dnd-mitigated", namespace: "demo-cases" },
        details: {
          workloadId: "Deployment:demo-cases:pdb-dnd-mitigated",
          pdbName: "pdb-dnd-mitigated-pdb",
          restoredMaxUnavailable: 1,
        },
      },
      created_at: iso(135),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "eviction",
      category: "POD_DISRUPTION_BLOCK_REMOVED",
      payload: {
        message: "Temporary disruption block cleared",
        target: { kind: "Deployment", name: "pdb-dnd-mitigated", namespace: "demo-cases" },
        details: {
          workloadId: "Deployment:demo-cases:pdb-dnd-mitigated",
          blockId: "win-2026-05-12",
        },
      },
      created_at: iso(180),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "eviction",
      category: "POD_DISRUPTION_BLOCK_RESTORED",
      payload: {
        message: "Disruption protection restored",
        target: { kind: "Deployment", name: "pdb-dnd-mitigated", namespace: "demo-cases" },
        details: { workloadId: "Deployment:demo-cases:pdb-dnd-mitigated" },
      },
      created_at: iso(195),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "node",
      category: "NODE_OVERLOAD_TAINT_REMOVED",
      payload: {
        message: "Overload taint removed; node healthy",
        target: { kind: "Node", name: "demo-node-1", namespace: "" },
        details: { nodeName: "demo-node-1", removedTaint: "node.cruisekube.io/overload=true" },
      },
      created_at: iso(205),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "recommendation",
      category: "MEMORY_RECOMMENDATION_APPLIED",
      payload: {
        message: "No change applied (already right-sized)",
        target: { kind: "Deployment", name: "tfy-llm-gateway-test-approval", namespace: "truefoundry" },
        details: { workloadId: "Deployment:truefoundry:tfy-llm-gateway-test-approval", skipped: true },
      },
      created_at: iso(320),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "admission",
      category: "WEBHOOK_MUTATION",
      payload: {
        message: "Webhook skipped GPU workload",
        target: { kind: "Deployment", name: "gpu-inference", namespace: "demo-cases" },
        details: {
          workloadId: "Deployment:demo-cases:gpu-inference",
          reason: "GPU_WORKLOAD",
        },
      },
      created_at: iso(480),
    },
    {
      cluster_id: DEMO_CLUSTER_ID,
      type: "recommendation",
      category: "CPU_RECOMMENDATION_APPLIED",
      payload: {
        message: "CPU updated (target only — no workloadId in details)",
        target: {
          kind: "Deployment",
          name: "tfy-llm-gateway-test-approval",
          namespace: "truefoundry",
        },
      },
      created_at: iso(1200),
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
  if (metric === "cpu") {
    return { data: remapTimelineToWindow(buildDemoCpuTimelineData(), startTime, endTime) };
  }
  if (metric === "memory") {
    return { data: remapTimelineToWindow(buildDemoMemoryTimelineData(), startTime, endTime) };
  }
  return { data: remapTimelineToWindow(buildDemoCostTimelineData(), startTime, endTime) };
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

/** Matches static / no-backend hosting: skip login (same contract as GET / when auth is off). */
export async function demoGetAuthInfo(): Promise<AuthInfoResponse> {
  await delay();
  return {
    auth_enabled: false,
    message: "Demo mode: no backend; authentication is disabled.",
  };
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

export async function demoGetPreflight(clusterID: string): Promise<PreflightResponse> {
  await delay();
  return clone<PreflightResponse>({
    cluster_id: clusterID,
    healthy: true,
    generated_at: new Date().toISOString(),
    summary: { total_checks: 20, passed: 20, failed: 0 },
    failures: [],
    prometheus_connectivity: {
      connected: true,
      healthy: true,
      url: "https://prometheus.demo.local",
      host: "prometheus.demo.local",
      port: "9090",
      probe: "buildinfo",
      version: "2.45.0",
      revision: "demo",
      error: "",
    },
    versions: {
      passed: true,
      min_kube_version: "1.24.0",
      min_prometheus_version: "2.30.0",
      nodes: [
        {
          name: "demo-node-1",
          kubelet_version: "v1.28.2",
          kube_proxy_version: "v1.28.2",
          os_image: "Ubuntu 22.04",
          container_runtime: "containerd://1.7.0",
          kernel_version: "5.15.0",
          architecture: "amd64",
          meets_minimum: true,
          error: "",
        },
      ],
      node_count: 1,
      nodes_below_minimum: 0,
      node_error: "",
      prometheus: { version: "2.45.0", meets_minimum: true, error: "" },
    },
    metrics: {
      passed: true,
      lookback: "15m",
      groups: [],
    },
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

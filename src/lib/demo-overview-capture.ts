import type { HistoricalTimelineDataPoint, OverviewResponse } from "@/lib/api";
import { chartCostVars, chartSeriesVar, chartThresholdVar } from "@/theme";

/**
 * Snapshot from GET .../ui/overview (cluster `default`) — used as demo seed.
 *
 * - CPU vs memory: requested/allocatable, usage/allocatable, and workloadRequested/allocatable
 *   percentages stay within **5 percentage points** of each other across CPU and memory.
 * - **currentMonthlyCost : currentSavings : possibleSavings** matches **CPU allocatable :
 *   requested : workloadRequested** (original requested), up to integer rounding on the dollar fields.
 */
const DEMO_CPU_ALLOC = 186.428;
const DEMO_CPU_REQUESTED = 149.941;
const DEMO_CPU_WORKLOAD_REQUESTED = 257.883;
const DEMO_CPU_USAGE = 112.137;
const DEMO_CPU_RECOMMENDED = 131.562;

const DEMO_MEM_ALLOC = 564.228;
const DEMO_MEM_REQUESTED = 429.941;
const DEMO_MEM_WORKLOAD_REQUESTED = 764.528;
const DEMO_MEM_USAGE = 355.628;
const DEMO_MEM_RECOMMENDED = 392.315;

/** Scale $ fields to same proportions as CPU alloc : requested : original requested (workloadRequested). */
const DEMO_COST_ANCHOR = 4889;
const DEMO_COST_SCALE = DEMO_COST_ANCHOR / DEMO_CPU_ALLOC;

export const DEMO_OVERVIEW_CAPTURE: OverviewResponse = {
  currentMonthlyCost: Math.round(DEMO_COST_SCALE * DEMO_CPU_ALLOC),
  currentSavings: Math.round(DEMO_COST_SCALE * DEMO_CPU_REQUESTED),
  possibleSavings: Math.round(DEMO_COST_SCALE * DEMO_CPU_WORKLOAD_REQUESTED),
  clusterUtilisation: Math.round(
    ((DEMO_CPU_USAGE / DEMO_CPU_ALLOC + DEMO_MEM_USAGE / DEMO_MEM_ALLOC) / 2) * 100
  ),
  nodeCount: 27,
  coverage: {
    adoption: {
      optimizable: 329,
      nonOptimizable: 2283,
      optimizableButExcluded: 110,
      total: 2722,
    },
    cpuCoverage: {
      enabed: 69.44663145187084,
      disabled: 30.553368548129157,
    },
    memoryCoverage: {
      enabed: 65.238457118304,
      disabled: 34.76154288169601,
    },
  },
  cpuStats: {
    allocatable: DEMO_CPU_ALLOC,
    requested: DEMO_CPU_REQUESTED,
    workloadRequested: DEMO_CPU_WORKLOAD_REQUESTED,
    usage: DEMO_CPU_USAGE,
    recommended: DEMO_CPU_RECOMMENDED,
  },
  memoryStats: {
    allocatable: DEMO_MEM_ALLOC,
    requested: DEMO_MEM_REQUESTED,
    workloadRequested: DEMO_MEM_WORKLOAD_REQUESTED,
    usage: DEMO_MEM_USAGE,
    recommended: DEMO_MEM_RECOMMENDED,
  },
};

/** Shared timeline timestamps (from production memory timeline sample). */
export const DEMO_TIMELINE_TIMESTAMPS: readonly string[] = [
  "2026-05-12T22:09:24.388915Z",
  "2026-05-12T22:13:36.995895Z",
  "2026-05-12T22:18:22.778567Z",
  "2026-05-12T22:24:17.813337Z",
  "2026-05-12T22:28:20.587566Z",
  "2026-05-12T22:33:20.408577Z",
  "2026-05-12T22:39:17.197307Z",
  "2026-05-12T22:43:20.801885Z",
  "2026-05-12T22:48:21.709031Z",
  "2026-05-12T22:54:18.590584Z",
] as const;

/** Per-row multipliers jitter around memory headline requested/usage ÷ allocatable. */
const MEM_REQ_MUL: readonly number[] = [0.772, 0.758, 0.767, 0.761, 0.774, 0.756, 0.765, 0.759, 0.771, 0.757];
const MEM_USE_MUL: readonly number[] = [0.635, 0.626, 0.638, 0.629, 0.624, 0.641, 0.627, 0.633, 0.625, 0.631];

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Memory timeline rows: [Allocatable, Requested, Original Requested, Usage, Recommended]. */
function memoryOverviewRatioRow(alloc: number, rowIndex: number): readonly [number, number, number, number, number] {
  const a = round3(alloc);
  const mulR = MEM_REQ_MUL[rowIndex % MEM_REQ_MUL.length]!;
  const mulU = MEM_USE_MUL[rowIndex % MEM_USE_MUL.length]!;
  const requested = round3(a * mulR);
  const usage = round3(a * mulU);
  const origBump = 1.087 + (rowIndex % 5) * 0.009;
  const originalRequested = round3(a * origBump);
  const recMid = (requested + usage) / 2;
  const recommended = round3(recMid * (1.014 + (rowIndex % 4) * 0.006));
  return [a, requested, originalRequested, usage, recommended] as const;
}

const MEM_ALLOCS: readonly number[] = [
  628.914, 631.205, 612.884, 615.991, 613.402, 616.778, 614.009, 611.227, 619.566, 605.441,
];

export const DEMO_MEMORY_SERIES_ROWS: readonly (readonly [number, number, number, number, number])[] =
  MEM_ALLOCS.map((alloc, i) => memoryOverviewRatioRow(alloc, i)) as readonly (readonly [
    number,
    number,
    number,
    number,
    number,
  ])[];

/** CPU timeline anchors: drift toward overview `cpuStats`; last row matches headline snapshot. */
const CPU_ANCHOR_ROWS: readonly (readonly [number, number, number, number, number])[] = [
  [193.281, 155.664, 250.881, 116.028, 135.891],
  [189.902, 152.841, 254.112, 113.971, 133.118],
  [
    DEMO_CPU_ALLOC,
    DEMO_CPU_REQUESTED,
    DEMO_CPU_WORKLOAD_REQUESTED,
    DEMO_CPU_USAGE,
    DEMO_CPU_RECOMMENDED,
  ],
] as const;

const cs = DEMO_OVERVIEW_CAPTURE.cpuStats;
const CPU_TARGET_ROW: readonly [number, number, number, number, number] = [
  cs?.allocatable ?? 0,
  cs?.requested ?? 0,
  cs?.workloadRequested ?? 0,
  cs?.usage ?? 0,
  cs?.recommended ?? 0,
] as const;

const LEGENDS = [
  "Allocatable",
  "Requested",
  "Original Requested",
  "Usage",
  "Recommended",
] as const;

const COLORS = chartSeriesVar;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cpuRowForIndex(i: number): readonly [number, number, number, number, number] {
  if (i < CPU_ANCHOR_ROWS.length) return CPU_ANCHOR_ROWS[i]!;
  const last = CPU_ANCHOR_ROWS.length - 1;
  const t = (i - last) / (DEMO_TIMELINE_TIMESTAMPS.length - last);
  const a = CPU_ANCHOR_ROWS[last]!;
  return [
    lerp(a[0], CPU_TARGET_ROW[0], t),
    lerp(a[1], CPU_TARGET_ROW[1], t),
    lerp(a[2], CPU_TARGET_ROW[2], t),
    lerp(a[3], CPU_TARGET_ROW[3], t),
    lerp(a[4], CPU_TARGET_ROW[4], t),
  ] as const;
}

function expandRowsToDataPoints(
  rows: readonly (readonly [number, number, number, number, number])[],
  timestamps: readonly string[]
): HistoricalTimelineDataPoint[] {
  const out: HistoricalTimelineDataPoint[] = [];
  for (let ti = 0; ti < timestamps.length; ti++) {
    const ts = timestamps[ti]!;
    const row = rows[ti] ?? rows[rows.length - 1]!;
    const alloc = row[0]!;
    for (let s = 0; s < 5; s++) {
      out.push({
        legend: LEGENDS[s]!,
        color: COLORS[s]!,
        threshold: { value: alloc, color: chartThresholdVar },
        data: { timestamp: ts, value: row[s]! },
      });
    }
  }
  return out;
}

/** CPU timeline: API-shaped series, first rows from capture, tail lerped to overview stats. */
export function buildDemoCpuTimelineData(): HistoricalTimelineDataPoint[] {
  const rows = DEMO_TIMELINE_TIMESTAMPS.map((_, i) => cpuRowForIndex(i));
  return expandRowsToDataPoints(rows, DEMO_TIMELINE_TIMESTAMPS);
}

/** Memory timeline: values from production capture (last row completed to match scale). */
export function buildDemoMemoryTimelineData(): HistoricalTimelineDataPoint[] {
  return expandRowsToDataPoints(DEMO_MEMORY_SERIES_ROWS, DEMO_TIMELINE_TIMESTAMPS);
}

/**
 * Remap template ISO timestamps into the client-requested window [startTime, endTime]
 * while preserving values (Overview charts need points inside the selected range).
 */
export function remapTimelineToWindow(
  template: HistoricalTimelineDataPoint[],
  startTime: string,
  endTime: string
): HistoricalTimelineDataPoint[] {
  const uniq = [...new Set(template.map((p) => p.data.timestamp))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  if (uniq.length === 0) return [];
  const t0 = new Date(uniq[0]!).getTime();
  const t1 = new Date(uniq[uniq.length - 1]!).getTime();
  const span = Math.max(t1 - t0, 1);
  const winStart = new Date(startTime).getTime();
  const winEnd = new Date(endTime).getTime();
  const winSpan = Math.max(winEnd - winStart, 60_000);

  const mapTs = (iso: string): string => {
    const x = new Date(iso).getTime();
    const u = (x - t0) / span;
    return new Date(winStart + u * winSpan).toISOString();
  };

  return template.map((p) => ({
    ...p,
    data: { ...p.data, timestamp: mapTs(p.data.timestamp) },
  }));
}

function costPoint(
  legend: string,
  color: string,
  thresholdValue: number,
  timestamp: string,
  value: number
): HistoricalTimelineDataPoint {
  return {
    legend,
    color,
    threshold: { value: thresholdValue, color: chartThresholdVar },
    data: { timestamp, value },
  };
}

/** From GET .../historical-timeline/cost (cluster `default`). Last triplet completed for 23:24:19. */
export const DEMO_COST_TIMELINE_CAPTURE: readonly HistoricalTimelineDataPoint[] = [
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.131341988992, "2026-05-12T22:43:20.801885Z", 11.853),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.131341988992, "2026-05-12T22:43:20.801885Z", 7.131),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.131341988992, "2026-05-12T22:43:20.801885Z", 4.795),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.239762010751999, "2026-05-12T22:48:21.709031Z", 12.039),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.239762010751999, "2026-05-12T22:48:21.709031Z", 7.24),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.239762010751999, "2026-05-12T22:48:21.709031Z", 4.866),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.071087112319999, "2026-05-12T22:54:18.590584Z", 11.703),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.071087112319999, "2026-05-12T22:54:18.590584Z", 7.071),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.071087112319999, "2026-05-12T22:54:18.590584Z", 4.678),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.071087112319999, "2026-05-12T22:58:20.5983Z", 11.793),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.071087112319999, "2026-05-12T22:58:20.5983Z", 7.071),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.071087112319999, "2026-05-12T22:58:20.5983Z", 4.701),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.532380518655998, "2026-05-12T23:03:36.966213Z", 12.568),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.532380518655998, "2026-05-12T23:03:36.966213Z", 7.532),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.532380518655998, "2026-05-12T23:03:36.966213Z", 4.985),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.182516446911999, "2026-05-12T23:09:26.39793Z", 11.9),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.182516446911999, "2026-05-12T23:09:26.39793Z", 7.183),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.182516446911999, "2026-05-12T23:09:26.39793Z", 4.806),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.182516446911999, "2026-05-12T23:13:21.395767Z", 11.941),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.182516446911999, "2026-05-12T23:13:21.395767Z", 7.183),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.182516446911999, "2026-05-12T23:13:21.395767Z", 4.852),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.181664973503999, "2026-05-12T23:18:41.401875Z", 11.925),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.181664973503999, "2026-05-12T23:18:41.401875Z", 7.182),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.181664973503999, "2026-05-12T23:18:41.401875Z", 4.84),
  costPoint("Hourly Cost Without CruiseKube", chartCostVars.withoutCruiseKube, 7.181664973504, "2026-05-12T23:24:19.00239Z", 11.938),
  costPoint("Hourly Cost", chartCostVars.hourly, 7.181664973504, "2026-05-12T23:24:19.00239Z", 7.182),
  costPoint("Hourly Cost With CruiseKube", chartCostVars.withCruiseKube, 7.181664973504, "2026-05-12T23:24:19.00239Z", 4.838),
];

export function buildDemoCostTimelineData(): HistoricalTimelineDataPoint[] {
  return [...DEMO_COST_TIMELINE_CAPTURE];
}

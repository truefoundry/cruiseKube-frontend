import type { HistoricalTimelineDataPoint, OverviewResponse } from "@/lib/api";
import { chartCostVars, chartSeriesVar, chartThresholdVar } from "@/theme";

/**
 * Snapshot from GET .../ui/overview (cluster `default`) — used as demo seed.
 * Allocatable : requested : usage = 1 : 0.8 : 0.6 for CPU and memory headline stats.
 */
export const DEMO_OVERVIEW_CAPTURE: OverviewResponse = {
  currentMonthlyCost: 4916,
  currentSavings: 7918,
  possibleSavings: 9783,
  clusterUtilisation: 60,
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
    allocatable: 200,
    requested: 160,
    workloadRequested: 260,
    usage: 120,
    recommended: 144,
  },
  memoryStats: {
    allocatable: 600,
    requested: 480,
    workloadRequested: 720,
    usage: 360,
    recommended: 432,
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

/** Memory timeline rows: [Allocatable, Requested, Original Requested, Usage, Recommended]; requested = 0.8×alloc, usage = 0.6×alloc. */
function memoryOverviewRatioRow(alloc: number): readonly [number, number, number, number, number] {
  return [alloc, 0.8 * alloc, 1.12 * alloc, 0.6 * alloc, 0.72 * alloc] as const;
}

export const DEMO_MEMORY_SERIES_ROWS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
])[] = [
  memoryOverviewRatioRow(630.427),
  memoryOverviewRatioRow(630.427),
  memoryOverviewRatioRow(614.313),
  memoryOverviewRatioRow(614.313),
  memoryOverviewRatioRow(614.313),
  memoryOverviewRatioRow(614.313),
  memoryOverviewRatioRow(614.313),
  memoryOverviewRatioRow(614.313),
  memoryOverviewRatioRow(621.428),
  memoryOverviewRatioRow(606.002),
] as const;

/** First three CPU timeline rows; cols 0,1,3 follow alloc : requested : usage = 1 : 0.8 : 0.6; tail lerps to overview cpuStats. */
const CPU_ANCHOR_ROWS: readonly (readonly [number, number, number, number, number])[] = [
  [205, 164, 229.6, 123, 147.6],
  [202, 161.6, 226.24, 121.2, 145.44],
  [200, 160, 224, 120, 144],
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

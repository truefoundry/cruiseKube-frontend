/**
 * TypeScript-facing theme — chart CSS variable names and event UI accents.
 * HSL / hex for app chrome live in `theme.css` (:root); keep chart hex in sync with those vars.
 */
export const chartSeriesVar = [
  "var(--cruisekube-chart-series-1)",
  "var(--cruisekube-chart-series-2)",
  "var(--cruisekube-chart-series-3)",
  "var(--cruisekube-chart-series-4)",
  "var(--cruisekube-chart-series-5)",
] as const;

export const chartCostVars = {
  hourly: "var(--cruisekube-chart-cost-hourly)",
  withoutCruiseKube: "var(--cruisekube-chart-cost-without-cruisekube)",
  withCruiseKube: "var(--cruisekube-chart-cost-with-cruisekube)",
} as const;

export const chartThresholdVar = "var(--cruisekube-chart-threshold)";

/** Event category icon colours — muted, professional (Tailwind JIT literals). */
export const eventCategoryIconColor = {
  CPU_RECOMMENDATION_APPLIED: "text-slate-400 dark:text-slate-300",
  MEMORY_RECOMMENDATION_APPLIED: "text-slate-500 dark:text-slate-400",
  POD_DISRUPTION_BLOCK_REMOVED: "text-stone-500 dark:text-stone-400",
  POD_DISRUPTION_BLOCK_RESTORED: "text-slate-400 dark:text-slate-300",
  PDB_RELAXED: "text-stone-500 dark:text-stone-400",
  PDB_RESTORED: "text-slate-500 dark:text-slate-400",
  WEBHOOK_MUTATION: "text-zinc-500 dark:text-zinc-400",
  POD_EVICTION: "text-red-700/90 dark:text-red-500/85",
  OOM_EVENT: "text-red-700/90 dark:text-red-500/85",
  NODE_OVERLOAD_TAINT_ADDED: "text-amber-800/85 dark:text-amber-600/75",
  NODE_OVERLOAD_TAINT_REMOVED: "text-slate-500 dark:text-slate-400",
} as const;

export type EventCategoryKey = keyof typeof eventCategoryIconColor;

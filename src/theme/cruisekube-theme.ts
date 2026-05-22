/**
 * TypeScript-facing theme — chart CSS variable names and event UI accents.
 * Keep chart values token-backed so defaults/fallbacks follow the active theme;
 * explicit API-provided chart colours should continue to pass through unchanged.
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

/** Event category icon colours — semantic, balanced light/dark Tailwind literals. */
export const eventCategoryIconColor = {
  CPU_RECOMMENDATION_APPLIED: "text-blue-600 dark:text-blue-400",
  MEMORY_RECOMMENDATION_APPLIED: "text-emerald-600 dark:text-emerald-400",
  POD_DISRUPTION_BLOCK_REMOVED: "text-amber-700 dark:text-amber-400",
  POD_DISRUPTION_BLOCK_RESTORED: "text-indigo-600 dark:text-indigo-400",
  PDB_RELAXED: "text-amber-700 dark:text-amber-400",
  PDB_RESTORED: "text-indigo-600 dark:text-indigo-400",
  WEBHOOK_MUTATION: "text-cyan-700 dark:text-cyan-400",
  POD_EVICTION: "text-red-700 dark:text-red-400",
  OOM_EVENT: "text-red-700 dark:text-red-400",
  NODE_OVERLOAD_TAINT_ADDED: "text-orange-700 dark:text-orange-400",
  NODE_OVERLOAD_TAINT_REMOVED: "text-sky-700 dark:text-sky-400",
} as const;

export type EventCategoryKey = keyof typeof eventCategoryIconColor;

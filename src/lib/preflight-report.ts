import type { PreflightResponse } from "@/lib/api";

/** Downloads the full preflight report as a JSON file the user can share with the team. */
export function downloadPreflightReport(data: PreflightResponse): void {
  const stamp = (data.generated_at || new Date().toISOString()).replace(/[:.]/g, "-");
  const filename = `preflight-${data.cluster_id || "cluster"}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

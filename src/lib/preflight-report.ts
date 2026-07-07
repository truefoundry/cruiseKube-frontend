import type { PreflightResponse } from "@/lib/api";

/** Builds a filesystem-safe report filename, e.g. `preflight-default-2026-07-07T10-00-00Z.json`. */
function preflightFilename(data: PreflightResponse, ext: string): string {
  const stamp = (data.generated_at || new Date().toISOString()).replace(/[:.]/g, "-");
  return `preflight-${data.cluster_id || "cluster"}-${stamp}.${ext}`;
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the full preflight report as JSON — the raw API response, complete
 * by construction (nothing summarized away), for sharing with the team.
 */
export function downloadPreflightJson(data: PreflightResponse): void {
  triggerDownload(
    preflightFilename(data, "json"),
    JSON.stringify(data, null, 2),
    "application/json"
  );
}

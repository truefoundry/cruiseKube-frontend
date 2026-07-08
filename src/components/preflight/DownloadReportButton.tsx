import { Download } from "lucide-react";
import type { PreflightResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { downloadPreflightJson } from "@/lib/preflight-report";

/**
 * Downloads the full preflight report as JSON — the raw API response, complete
 * by construction (nothing summarized away), for sharing with the team.
 */
export function DownloadReportButton({
  data,
  variant = "outline",
}: {
  data: PreflightResponse;
  variant?: "outline" | "default" | "secondary" | "ghost";
}) {
  return (
    <Button variant={variant} onClick={() => downloadPreflightJson(data)} className="gap-2">
      <Download className="h-4 w-4" />
      Download report
    </Button>
  );
}

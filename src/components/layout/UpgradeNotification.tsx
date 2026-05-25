import { ArrowUpCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfig } from "@/contexts/ConfigContext";
import { useUpgradeAvailable } from "@/hooks/useUpgradeAvailable";
import { CRUISEKUBE_LATEST_RELEASE_URL, formatVersionForDisplay } from "@/lib/github-release";
import { cn } from "@/lib/utils";

function UpgradeNotificationContent({
  currentVersion,
  latestVersion,
  releaseUrl,
  onDismiss,
  className,
}: {
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  onDismiss: () => void;
  className?: string;
}) {
  const upgradeUrl = releaseUrl ?? CRUISEKUBE_LATEST_RELEASE_URL;

  return (
    <div className={cn("relative min-w-0 overflow-hidden rounded-lg border border-warning/25 bg-warning/10 p-3 pr-8 shadow-sm", className)}>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 inline-flex rounded-md p-0.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="Dismiss upgrade notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex min-w-0 items-start gap-2">
        <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">Update available</p>
            <dl className="mt-1 space-y-0.5 text-xs leading-5 text-sidebar-foreground/80">
              <div className="flex min-w-0 gap-1">
                <dt className="shrink-0">Latest:</dt>
                <dd className="min-w-0 truncate font-mono" title={latestVersion}>
                  {formatVersionForDisplay(latestVersion)}
                </dd>
              </div>
              <div className="flex min-w-0 gap-1">
                <dt className="shrink-0">Current:</dt>
                <dd className="min-w-0 truncate font-mono" title={currentVersion}>
                  {formatVersionForDisplay(currentVersion)}
                </dd>
              </div>
            </dl>
          </div>
          <Button asChild size="sm" className="h-7 w-full px-3 text-xs shadow-none">
            <a href={upgradeUrl} target="_blank" rel="noopener noreferrer">
              View release
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UpgradeNotification() {
  const { config } = useConfig();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { showNotification, currentVersion, latestVersion, releaseUrl, dismiss } = useUpgradeAvailable(config?.version);

  if (!showNotification || !currentVersion || !latestVersion) {
    return null;
  }

  if (isCollapsed) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex w-full justify-center rounded-lg border border-warning/25 bg-warning/10 p-2 text-warning transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={`Update available: ${latestVersion}`}
              >
                <ArrowUpCircle className="h-4 w-4 shrink-0" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Update available</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="end" className="w-64 p-0">
          <UpgradeNotificationContent
            currentVersion={currentVersion}
            latestVersion={latestVersion}
            releaseUrl={releaseUrl}
            onDismiss={dismiss}
            className="border-0 shadow-none"
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <UpgradeNotificationContent
      currentVersion={currentVersion}
      latestVersion={latestVersion}
      releaseUrl={releaseUrl}
      onDismiss={dismiss}
    />
  );
}

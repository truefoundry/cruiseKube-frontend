import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { isDemoMode } from "@/lib/demo-mode";
import { fetchLatestGitHubRelease, isUpgradeAvailable, normalizeVersion } from "@/lib/github-release";
import {
  dismissUpgradeNotification,
  getDismissedUpgradeVersion,
} from "@/lib/upgrade-notification-storage";

export function useUpgradeAvailable(currentVersion?: string) {
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => getDismissedUpgradeVersion());

  const { data: latestRelease } = useQuery({
    queryKey: ["github-latest-release", currentVersion],
    queryFn: fetchLatestGitHubRelease,
    enabled: !isDemoMode && !!currentVersion,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const latestVersion = latestRelease?.tagName;
  const releaseUrl = latestRelease?.htmlUrl;
  const hasNewerRelease =
    !!currentVersion && !!latestVersion && isUpgradeAvailable(currentVersion, latestVersion);
  const isDismissed = latestVersion ? dismissedVersion === normalizeVersion(latestVersion) : false;

  const dismiss = useCallback(() => {
    if (!latestVersion) {
      return;
    }

    dismissUpgradeNotification(latestVersion);
    setDismissedVersion(normalizeVersion(latestVersion));
  }, [latestVersion]);

  return {
    showNotification: hasNewerRelease && !isDismissed,
    currentVersion,
    latestVersion,
    releaseUrl,
    dismiss,
  };
}

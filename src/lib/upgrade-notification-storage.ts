import { normalizeVersion } from "@/lib/github-release";

const STORAGE_KEY = "cruisekube:upgrade-notification-dismissed";

export function getDismissedUpgradeVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function dismissUpgradeNotification(latestVersion: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeVersion(latestVersion));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function isUpgradeNotificationDismissed(latestVersion: string): boolean {
  return getDismissedUpgradeVersion() === normalizeVersion(latestVersion);
}

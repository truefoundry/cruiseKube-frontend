export const CRUISEKUBE_GITHUB_REPO = "truefoundry/CruiseKube";
export const CRUISEKUBE_LATEST_RELEASE_URL = `https://github.com/${CRUISEKUBE_GITHUB_REPO}/releases/latest`;

const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${CRUISEKUBE_GITHUB_REPO}/releases/latest`;

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

/** Shortens long git SHAs and version strings for narrow sidebar UI. */
export function formatVersionForDisplay(version: string, maxLength = 14): string {
  const trimmed = version.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length >= 7) {
    return `${trimmed.slice(0, 7)}…`;
  }

  return `${trimmed.slice(0, maxLength)}…`;
}

function parseVersionParts(version: string): number[] {
  return normalizeVersion(version)
    .split(/[.+_-]/)
    .map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number.parseInt(match[0], 10) : 0;
    });
}

/** Returns negative if `a` is older than `b`, positive if newer, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const partsA = parseVersionParts(a);
  const partsB = parseVersionParts(b);
  const length = Math.max(partsA.length, partsB.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export function isUpgradeAvailable(currentVersion: string, latestVersion: string): boolean {
  if (!normalizeVersion(currentVersion) || !normalizeVersion(latestVersion)) {
    return false;
  }

  return compareVersions(currentVersion, latestVersion) < 0;
}

export interface GitHubLatestRelease {
  tagName: string;
  htmlUrl: string;
}

export async function fetchLatestGitHubRelease(): Promise<GitHubLatestRelease> {
  const response = await fetch(GITHUB_LATEST_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release (${response.status})`);
  }

  const data = (await response.json()) as { tag_name?: string; html_url?: string };

  if (!data.tag_name || !data.html_url) {
    throw new Error("Latest release response is missing version metadata");
  }

  return {
    tagName: data.tag_name,
    htmlUrl: data.html_url,
  };
}

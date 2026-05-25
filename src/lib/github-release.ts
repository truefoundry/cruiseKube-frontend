export const CRUISEKUBE_GITHUB_REPO = "truefoundry/CruiseKube";
export const CRUISEKUBE_LATEST_RELEASE_URL = `https://github.com/${CRUISEKUBE_GITHUB_REPO}/releases/latest`;

const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${CRUISEKUBE_GITHUB_REPO}/releases/latest`;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

type VersionParts = [number, number, number];

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

function parseVersionParts(version: string): VersionParts | null {
  const normalized = normalizeVersion(version);
  const match = normalized.match(SEMVER_PATTERN);

  if (!match) {
    return null;
  }

  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10)];
}

function compareVersionParts(partsA: VersionParts, partsB: VersionParts): number {
  for (let index = 0; index < partsA.length; index += 1) {
    const diff = partsA[index] - partsB[index];
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

/** Returns negative if `a` is older than `b`, positive if newer, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const partsA = parseVersionParts(a);
  const partsB = parseVersionParts(b);

  if (!partsA || !partsB) {
    return 0;
  }

  return compareVersionParts(partsA, partsB);
}

export function isUpgradeAvailable(currentVersion: string, latestVersion: string): boolean {
  const currentParts = parseVersionParts(currentVersion);
  const latestParts = parseVersionParts(latestVersion);

  if (!currentParts || !latestParts) {
    return false;
  }

  return compareVersionParts(currentParts, latestParts) < 0;
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

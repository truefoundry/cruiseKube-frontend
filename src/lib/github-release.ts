export const CRUISEKUBE_GITHUB_REPO = "truefoundry/CruiseKube";
export const CRUISEKUBE_LATEST_RELEASE_URL = `https://github.com/${CRUISEKUBE_GITHUB_REPO}/releases/latest`;

const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${CRUISEKUBE_GITHUB_REPO}/releases/latest`;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

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

function parseVersion(version: string): ParsedVersion | null {
  const match = normalizeVersion(version).match(SEMVER_PATTERN);

  if (!match) {
    return null;
  }

  const [, major, minor, patch, prerelease] = match;

  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

function comparePrereleaseIdentifiers(a: string, b: string): number {
  const aIsNumeric = /^\d+$/.test(a);
  const bIsNumeric = /^\d+$/.test(b);

  if (aIsNumeric && bIsNumeric) {
    return Number.parseInt(a, 10) - Number.parseInt(b, 10);
  }

  if (aIsNumeric) {
    return -1;
  }

  if (bIsNumeric) {
    return 1;
  }

  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareParsedVersions(a: ParsedVersion, b: ParsedVersion): number {
  const coreDiff = a.major - b.major || a.minor - b.minor || a.patch - b.patch;

  if (coreDiff !== 0) {
    return coreDiff;
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) {
    return 0;
  }

  if (a.prerelease.length === 0) {
    return 1;
  }

  if (b.prerelease.length === 0) {
    return -1;
  }

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const partA = a.prerelease[index];
    const partB = b.prerelease[index];

    if (partA === undefined) {
      return -1;
    }

    if (partB === undefined) {
      return 1;
    }

    const diff = comparePrereleaseIdentifiers(partA, partB);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

/** Returns negative if `a` is older than `b`, positive if newer, 0 if equal or not comparable. */
export function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (!versionA || !versionB) {
    return 0;
  }

  return compareParsedVersions(versionA, versionB);
}

export function isUpgradeAvailable(currentVersion: string, latestVersion: string): boolean {
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

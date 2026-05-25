import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";

async function loadGithubReleaseHelpers() {
  const source = await readFile(new URL("./github-release.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { compareVersions, isUpgradeAvailable } = await loadGithubReleaseHelpers();

describe("github release version helpers", () => {
  it("detects upgrades for full SemVer versions", () => {
    assert.equal(isUpgradeAvailable("1.2.3", "1.2.4"), true);
    assert.equal(isUpgradeAvailable("v1.2.3", "v2.0.0"), true);
    assert.equal(isUpgradeAvailable("1.2.3", "1.2.3"), false);
    assert.equal(isUpgradeAvailable("1.2.4", "1.2.3"), false);
  });

  it("accepts valid SemVer prerelease and build metadata", () => {
    assert.equal(isUpgradeAvailable("1.2.3-alpha.1+build.5", "1.2.4"), true);
    assert.equal(isUpgradeAvailable("1.2.3", "1.2.3+build.5"), false);
  });

  it("ignores non-SemVer current versions", () => {
    assert.equal(isUpgradeAvailable("1", "1.2.3"), false);
    assert.equal(isUpgradeAvailable("1.2", "1.2.3"), false);
    assert.equal(isUpgradeAvailable("64e94d29c1b9", "1.2.3"), false);
    assert.equal(isUpgradeAvailable("1.2.3foo", "1.2.4"), false);
  });

  it("ignores non-SemVer latest versions", () => {
    assert.equal(isUpgradeAvailable("0.3.1", "2024-06-01"), false);
    assert.equal(isUpgradeAvailable("0.3.1", "1.2"), false);
    assert.equal(isUpgradeAvailable("0.3.1", "64e94d29c1b9"), false);
    assert.equal(isUpgradeAvailable("0.3.1", "1.2.3foo"), false);
  });

  it("compares the fixed major, minor, and patch tuple", () => {
    assert.equal(compareVersions("1.2.3", "1.2.4") < 0, true);
    assert.equal(compareVersions("1.3.0", "1.2.4") > 0, true);
    assert.equal(compareVersions("2.0.0", "2.0.0+build.1"), 0);
    assert.equal(compareVersions("not-semver", "1.2.3"), 0);
  });
});

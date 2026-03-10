import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectDependencies } from "../../lib/analysis/dependency-detector.js";

describe("detectDependencies", () => {
  const testDir = join(tmpdir(), `docaware-test-${Date.now()}`);

  it("detects Node.js dependencies from package.json", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      join(testDir, "package.json"),
      JSON.stringify({
        dependencies: { openai: "^4.20.0", express: "^4.18.0" },
        devDependencies: { jest: "^29.0.0" },
      })
    );

    const deps = await detectDependencies(testDir, "js");
    assert.ok(deps.length >= 3);
    assert.ok(deps.some((d) => d.name === "openai" && d.type === "prod"));
    assert.ok(deps.some((d) => d.name === "jest" && d.type === "dev"));

    await rm(testDir, { recursive: true, force: true });
  });

  it("detects Python dependencies from requirements.txt", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      join(testDir, "requirements.txt"),
      "openai==1.3.0\nflask>=2.0\nrequests\n"
    );

    const deps = await detectDependencies(testDir, "py");
    assert.ok(deps.some((d) => d.name === "openai" && d.version === "1.3.0"));
    assert.ok(deps.some((d) => d.name === "flask"));
    assert.ok(deps.some((d) => d.name === "requests"));

    await rm(testDir, { recursive: true, force: true });
  });

  it("returns empty array for missing package.json", async () => {
    await mkdir(testDir, { recursive: true });
    const deps = await detectDependencies(testDir, "js");
    assert.deepEqual(deps, []);
    await rm(testDir, { recursive: true, force: true });
  });
});

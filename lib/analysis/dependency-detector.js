import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Detect project dependencies and their versions.
 * Supports package.json (Node.js) and requirements.txt (Python).
 */
export async function detectDependencies(projectDir, lang = "js") {
  if (lang === "py") {
    return detectPythonDeps(projectDir);
  }
  return detectNodeDeps(projectDir);
}

/**
 * Parse version string to clean semver-ish version.
 * "^4.2.1" -> "4.2.1", "~3.0.0" -> "3.0.0", ">=2.0" -> "2.0"
 */
function cleanVersion(version) {
  return version.replace(/^[\^~>=<]+/, "").trim();
}

async function detectNodeDeps(projectDir) {
  const deps = [];

  // Try package.json
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(projectDir, "package.json"), "utf-8"));
  } catch {
    return deps;
  }

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // Try to get locked versions from package-lock.json
  let lockfile = null;
  try {
    lockfile = JSON.parse(await readFile(join(projectDir, "package-lock.json"), "utf-8"));
  } catch {
    // No lockfile, use package.json versions
  }

  for (const [name, versionRange] of Object.entries(allDeps)) {
    let version = cleanVersion(versionRange);

    // Get exact version from lockfile if available
    if (lockfile?.packages?.[`node_modules/${name}`]) {
      version = lockfile.packages[`node_modules/${name}`].version || version;
    } else if (lockfile?.dependencies?.[name]) {
      version = lockfile.dependencies[name].version || version;
    }

    const isDev = !pkg.dependencies?.[name];

    deps.push({
      name,
      version,
      versionRange,
      type: isDev ? "dev" : "prod",
      lang: "js",
    });
  }

  return deps;
}

async function detectPythonDeps(projectDir) {
  const deps = [];

  // Try requirements.txt
  try {
    const content = await readFile(join(projectDir, "requirements.txt"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;

      const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*(?:==|>=|~=)\s*(.+)/);
      if (match) {
        deps.push({
          name: match[1],
          version: match[2].trim(),
          versionRange: trimmed,
          type: "prod",
          lang: "py",
        });
      } else {
        // Package without version pin
        deps.push({
          name: trimmed.split(/[<>=!]/)[0].trim(),
          version: "unknown",
          versionRange: trimmed,
          type: "prod",
          lang: "py",
        });
      }
    }
  } catch {
    // No requirements.txt
  }

  // Try pyproject.toml (basic parsing)
  try {
    const content = await readFile(join(projectDir, "pyproject.toml"), "utf-8");
    const depsSection = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depsSection) {
      const depLines = depsSection[1].matchAll(/"([^"]+)"/g);
      for (const m of depLines) {
        const match = m[1].match(/^([a-zA-Z0-9_-]+)\s*(?:==|>=|~=)\s*(.+)/);
        if (match) {
          deps.push({
            name: match[1],
            version: match[2].trim(),
            versionRange: m[1],
            type: "prod",
            lang: "py",
          });
        }
      }
    }
  } catch {
    // No pyproject.toml
  }

  return deps;
}

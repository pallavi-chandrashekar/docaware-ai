import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

const DEFAULTS = {
  llm: {
    provider: null, // auto-detect from env vars: ANTHROPIC_API_KEY → claude, OPENAI_API_KEY → openai, GOOGLE_API_KEY → gemini, else → ollama
    model: null, // use provider default if null
    max_tokens: 4096,
  },
  // Legacy "claude" section still supported for backwards compat
  claude: {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
  },
  review: {
    severity_threshold: "low",
    categories: ["deprecated_api", "anti_pattern", "incorrect_usage", "security"],
    ignore_patterns: ["**/*.test.js", "**/node_modules/**", "dist/**"],
  },
  migrate: {
    lang: "js",
    scan_dir: ".",
  },
  memory: {
    enabled: true,
    storage_dir: ".docaware/memory",
    max_context_entries: 10,
  },
  output: {
    format: "terminal",
    color: !process.env.NO_COLOR,
  },
  benchmark: {
    enabled: false,
    output_dir: ".docaware/benchmarks",
  },
};

/**
 * Walk up from startDir to filesystem root looking for .docaware.yml.
 */
function findConfigFile(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, ".docaware.yml");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Deep merge two objects. Source values override target values.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load and resolve configuration.
 * Priority: CLI flags > .docaware.yml > defaults
 */
export async function loadConfig(cliOverrides = {}) {
  let fileConfig = {};

  // Try loading YAML config
  const configPath = cliOverrides.config || findConfigFile(process.cwd());
  if (configPath) {
    try {
      const { default: yaml } = await import("js-yaml");
      const content = await readFile(configPath, "utf-8");
      fileConfig = yaml.load(content) || {};
    } catch (err) {
      if (cliOverrides.config) {
        throw new Error(`Failed to load config from ${configPath}: ${err.message}`);
      }
      // Silently ignore auto-detected config that fails to parse
    }
  }

  // Merge: defaults < file config < CLI overrides
  let config = deepMerge(DEFAULTS, fileConfig);
  config = deepMerge(config, cliOverrides);

  // Resolve API keys from environment
  config.claude.api_key = process.env.ANTHROPIC_API_KEY || null;
  config.llm.api_key = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY || null;

  // Resolve NO_COLOR
  if (cliOverrides.no_color || process.env.NO_COLOR) {
    config.output.color = false;
  }

  return config;
}

/**
 * Validate that required config is present for a given command.
 */
export function validateConfig(config, command) {
  if ((command === "review" || command === "migrate") && !config.llm?.api_key && !config.claude?.api_key && config.llm?.provider !== "ollama") {
    // LLM features need an API key (unless using Ollama), but --no-llm mode doesn't
    return { valid: true, warning: "No LLM API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY. Or use --provider ollama for local models." };
  }
  return { valid: true };
}

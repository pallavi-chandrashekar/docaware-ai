import { parseArgs } from "node:util";
import { loadConfig, validateConfig } from "../core/config.js";
import { setVerbose, info, error, BenchmarkLogger } from "../core/logger.js";
import { Reviewer } from "../review/reviewer.js";
import { ClaudeClient } from "../llm/claude-client.js";
import { MemoryStore } from "../memory/memory-store.js";
import { formatOutput } from "../output/reporter.js";

function printUsage() {
  info(`
Usage: docaware review [options]

Scan project code against real API documentation.

Options:
  --dir <path>       Project directory (default: current directory)
  --lang <js|py>     Language (default: js)
  --format <type>    Output: terminal, json, markdown (default: terminal)
  --severity <level> Minimum severity: low, medium, high, critical (default: low)
  --benchmark        Enable benchmark instrumentation
  --verbose          Verbose logging
  --help             Show this help
`);
}

export async function run(argv) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        dir: { type: "string", default: process.cwd() },
        lang: { type: "string", default: "js" },
        format: { type: "string", default: "terminal" },
        severity: { type: "string", default: "low" },
        benchmark: { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (e) {
    error(e.message);
    printUsage();
    process.exit(1);
  }

  if (args.values.help) {
    printUsage();
    return;
  }

  if (args.values.verbose) setVerbose(true);

  const config = await loadConfig({
    review: { severity_threshold: args.values.severity },
    output: { format: args.values.format },
    benchmark: { enabled: args.values.benchmark },
  });

  const { valid, warning } = validateConfig(config, "review");
  if (warning) {
    error(warning);
    error("Set ANTHROPIC_API_KEY to enable AI-powered code review.");
    process.exit(1);
  }

  const benchmarkLogger = new BenchmarkLogger(config.benchmark.enabled);

  const claudeClient = new ClaudeClient({
    apiKey: config.claude.api_key,
    model: config.claude.model,
    maxTokens: config.claude.max_tokens,
  });

  let memoryStore = null;
  if (config.memory.enabled) {
    memoryStore = new MemoryStore({ config, benchmarkLogger });
  }

  const reviewer = new Reviewer({
    config,
    claudeClient,
    memoryStore,
    benchmarkLogger,
  });

  const result = await reviewer.review({
    projectDir: args.values.dir,
    lang: args.values.lang,
  });

  const output = formatOutput("review", result, args.values.format);
  info(output);

  // Output benchmark data if enabled
  if (config.benchmark.enabled) {
    const benchData = benchmarkLogger.getEntries();
    info("\n--- Benchmark Data ---");
    info(JSON.stringify(benchData, null, 2));
  }
}

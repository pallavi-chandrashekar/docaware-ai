import { parseArgs } from "node:util";
import { loadConfig } from "../core/config.js";
import { setVerbose, info, error, BenchmarkLogger } from "../core/logger.js";
import { Migrator } from "../migrate/migrator.js";
import { createLLMClient } from "../llm/create-client.js";
import { MemoryStore } from "../memory/memory-store.js";
import { formatOutput } from "../output/reporter.js";

function printUsage() {
  info(`
Usage: docaware migrate <library> --from <version> --to <version> [options]

Detect breaking API changes and generate migration plans.

Options:
  --from <version>   Old/current library version
  --to <version>     New/target library version
  --dir <path>       Project directory (default: current directory)
  --lang <js|py>     Language (default: js)
  --format <type>    Output: terminal, json, markdown (default: terminal)
  --no-llm           Skip AI-powered migration plan (pure analysis only)
  --benchmark        Enable benchmark instrumentation
  --verbose          Verbose logging
  --help             Show this help

Examples:
  docaware migrate openai --from 3.0 --to 4.0
  docaware migrate stripe --from 2.0 --to 3.0 --lang js --dir ./my-project
  docaware migrate express --from 4.0.0 --to 5.0.0 --no-llm
`);
}

export async function run(argv) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        from: { type: "string" },
        to: { type: "string" },
        dir: { type: "string", default: process.cwd() },
        lang: { type: "string", default: "js" },
        format: { type: "string", default: "terminal" },
        "no-llm": { type: "boolean", default: false },
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

  const library = args.positionals[0];
  const { from: oldVersion, to: newVersion } = args.values;

  if (!library || !oldVersion || !newVersion) {
    error("library name, --from, and --to are required.");
    printUsage();
    process.exit(1);
  }

  if (args.values.verbose) setVerbose(true);

  const noLlm = args.values["no-llm"];
  const config = await loadConfig({
    output: { format: args.values.format },
    benchmark: { enabled: args.values.benchmark },
  });

  const benchmarkLogger = new BenchmarkLogger(config.benchmark.enabled);

  let claudeClient = null;
  const hasApiKey = config.llm.api_key || config.claude.api_key || config.llm.provider === "ollama";
  if (!noLlm && hasApiKey) {
    claudeClient = await createLLMClient({
      provider: config.llm.provider,
      model: config.llm.model || config.claude.model,
      max_tokens: config.llm.max_tokens || config.claude.max_tokens,
      api_key: config.llm.api_key || config.claude.api_key,
    });
  }

  let memoryStore = null;
  if (config.memory.enabled) {
    memoryStore = new MemoryStore({ config, benchmarkLogger });
  }

  const migrator = new Migrator({
    config,
    claudeClient,
    memoryStore,
    benchmarkLogger,
  });

  const result = await migrator.migrate({
    library,
    oldVersion,
    newVersion,
    projectDir: args.values.dir,
    lang: args.values.lang,
    noLlm: noLlm || !config.claude.api_key,
  });

  const output = formatOutput("migration", result, args.values.format);
  info(output);

  if (config.benchmark.enabled) {
    const benchData = benchmarkLogger.getEntries();
    info("\n--- Benchmark Data ---");
    info(JSON.stringify(benchData, null, 2));
  }
}

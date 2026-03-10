#!/usr/bin/env node

import { parseArgs } from "node:util";

const COMMANDS = {
  review: () => import("../lib/cli/review-cmd.js"),
  migrate: () => import("../lib/cli/migrate-cmd.js"),
  memory: () => import("../lib/cli/memory-cmd.js"),
};

function printUsage() {
  console.log(`
docaware — Doc-Augmented AI Dev Assistant

Usage: docaware <command> [options]

Commands:
  review     AI code review against real API documentation
  migrate    Detect breaking changes and generate migration plans
  memory     Manage persistent agent memory across sessions

Global options:
  --config <path>    Path to .docaware.yml (default: auto-detect)
  --format <type>    Output format: terminal, json, markdown
  --no-color         Disable ANSI colors
  --verbose          Verbose logging
  --benchmark        Enable benchmark instrumentation (for research)
  --help             Show this help message
  --version          Show version

Examples:
  docaware review --dir ./my-project
  docaware migrate openai --from 3.0 --to 4.0
  docaware memory search "stripe webhook verification"

Research mode:
  docaware review --benchmark --dir ./project
    Logs hallucination counts, doc-retrieval hits, and memory recall
    precision for paper evaluation.
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  if (args[0] === "--version" || args[0] === "-v") {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { join, dirname } = await import("node:path");
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    console.log(`docaware v${pkg.version}`);
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  if (!COMMANDS[command]) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  try {
    const mod = await COMMANDS[command]();
    await mod.run(commandArgs);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    if (process.env.DOCAWARE_DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();

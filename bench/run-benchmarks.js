#!/usr/bin/env node

/**
 * Benchmark runner CLI.
 *
 * Runs the A/B/C/D experiment across all fixture projects and
 * generates paper-ready results.
 *
 * Usage:
 *   node bench/run-benchmarks.js                    # Run all benchmarks
 *   node bench/run-benchmarks.js --fixture openai   # Run specific fixture
 *   node bench/run-benchmarks.js --condition A,C,D  # Run specific conditions
 *   node bench/run-benchmarks.js --analyze           # Analyze existing results
 */

import { parseArgs } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib/core/config.js";
import { runExperiment } from "../lib/benchmark/experiment-runner.js";
import { aggregateExperiments, generateAnalysisSummary, generateLatexTable } from "../lib/benchmark/analyze.js";
import { info, c, error } from "../lib/core/logger.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");
const OUTPUT_DIR = resolve(".docaware/benchmarks");

const args = parseArgs({
  options: {
    fixture: { type: "string" },
    condition: { type: "string", default: "A,B,C,D" },
    analyze: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (args.values.help) {
  info(`
Benchmark Runner for DocAware AI Dev Assistant

Usage:
  node bench/run-benchmarks.js                       Run all benchmark fixtures
  node bench/run-benchmarks.js --fixture openai      Run specific fixture
  node bench/run-benchmarks.js --condition A,C,D     Run specific conditions
  node bench/run-benchmarks.js --analyze             Analyze existing results

Conditions:
  A  Baseline LLM (no docs, no memory)
  B  LLM + raw docs (naive RAG)
  C  LLM + structured doc retrieval (DocAware)
  D  LLM + structured docs + memory (full DocAware)

Fixtures:
  openai-v3-project     OpenAI v3 -> v4 migration issues (8 ground truth)
  express-v4-project    Express v4 -> v5 migration issues (6 ground truth)
  stripe-v2-project     Stripe API misuse patterns (5 ground truth)

Requirements:
  ANTHROPIC_API_KEY environment variable must be set.

Output:
  .docaware/benchmarks/<experiment-id>/
    results.json    Raw experiment data
    summary.md      Markdown comparison table
    events.jsonl    Structured event log for analysis
`);
  process.exit(0);
}

async function main() {
  // Analyze mode
  if (args.values.analyze) {
    info(c.bold("\n  Analyzing existing benchmark results...\n"));

    const experiments = [];
    try {
      const entries = await readdir(OUTPUT_DIR);
      for (const entry of entries) {
        try {
          const data = JSON.parse(
            await readFile(join(OUTPUT_DIR, entry, "results.json"), "utf-8")
          );
          experiments.push(data);
        } catch {
          // Skip
        }
      }
    } catch {
      error("No benchmark results found. Run benchmarks first.");
      process.exit(1);
    }

    if (experiments.length === 0) {
      error("No experiment results found.");
      process.exit(1);
    }

    info(`Found ${experiments.length} experiment(s)\n`);
    const aggregated = aggregateExperiments(experiments);
    info(generateAnalysisSummary(aggregated));
    info("\n--- LaTeX Table (for paper) ---\n");
    info(generateLatexTable(aggregated));
    return;
  }

  // Run mode
  const config = await loadConfig();
  if (!config.claude.api_key) {
    error("ANTHROPIC_API_KEY is required to run benchmarks.");
    error("Set it with: export ANTHROPIC_API_KEY=your-key");
    process.exit(1);
  }

  const conditions = args.values.condition.split(",").map((c) => c.trim());

  // Discover fixtures
  let fixtures;
  try {
    fixtures = await readdir(FIXTURES_DIR);
  } catch {
    error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  if (args.values.fixture) {
    const match = fixtures.find((f) => f.includes(args.values.fixture));
    if (!match) {
      error(`Fixture not found: ${args.values.fixture}`);
      error(`Available: ${fixtures.join(", ")}`);
      process.exit(1);
    }
    fixtures = [match];
  }

  info(c.bold("\n  DocAware Benchmark Suite"));
  info(c.dim(`  Fixtures: ${fixtures.join(", ")}`));
  info(c.dim(`  Conditions: ${conditions.join(", ")}`));
  info(c.dim(`  Output: ${OUTPUT_DIR}`));
  info("");

  for (const fixture of fixtures) {
    const fixtureDir = join(FIXTURES_DIR, fixture);

    // Load ground truth if available
    let groundTruth = null;
    try {
      groundTruth = JSON.parse(
        await readFile(join(fixtureDir, "ground-truth.json"), "utf-8")
      );
      info(c.dim(`  Ground truth: ${groundTruth.length} entries for ${fixture}`));
    } catch {
      info(c.dim(`  No ground truth for ${fixture}`));
    }

    info(c.bold(`\n  === ${fixture} ===\n`));

    try {
      await runExperiment({
        projectDir: fixtureDir,
        lang: "js",
        config,
        conditions,
        groundTruth,
        outputDir: OUTPUT_DIR,
      });
    } catch (err) {
      error(`Experiment failed for ${fixture}: ${err.message}`);
    }
  }

  info(c.bold("\n  All benchmarks complete."));
  info(c.dim(`  Run 'node bench/run-benchmarks.js --analyze' to see aggregated results.\n`));
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});

/**
 * A/B/C/D Experiment Runner for the research paper.
 *
 * Conditions:
 *   A) Baseline LLM — no docs, no memory
 *   B) LLM + raw docs — naive RAG (docs dumped into context)
 *   C) LLM + structured doc retrieval — DocAware retriever
 *   D) LLM + structured docs + memory — Full DocAware pipeline
 *
 * Each condition runs the same code review task on the same project,
 * with only the doc/memory layer varying.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createLLMClient } from "../llm/create-client.js";
import { DocRetriever } from "../docs/doc-retriever.js";
import { detectDependencies } from "../analysis/dependency-detector.js";
import { MemoryStore } from "../memory/memory-store.js";
import { Reviewer } from "../review/reviewer.js";
import { Migrator } from "../migrate/migrator.js";
import { BenchmarkLogger, info, c } from "../core/logger.js";
import { analyzeHallucinations, evaluateAgainstGroundTruth } from "./hallucination-detector.js";

const CONDITIONS = {
  A: { name: "Baseline (no docs)", docs: false, memory: false },
  B: { name: "Raw docs (naive RAG)", docs: "raw", memory: false },
  C: { name: "Structured docs (DocAware)", docs: "structured", memory: false },
  D: { name: "Full DocAware (docs + memory)", docs: "structured", memory: true },
};

/**
 * Run a single experimental condition.
 */
async function runCondition(conditionId, { projectDir, lang, config, groundTruth }) {
  const condition = CONDITIONS[conditionId];
  const benchmarkLogger = new BenchmarkLogger(true);
  benchmarkLogger.log("condition_start", { id: conditionId, name: condition.name });

  // Create LLM client (use higher max_tokens for benchmarks to avoid truncation)
  const claudeClient = await createLLMClient({
    provider: config.llm?.provider,
    model: config.llm?.model || config.claude.model,
    max_tokens: Math.max(config.llm?.max_tokens || config.claude.max_tokens, 8192),
    api_key: config.llm?.api_key || config.claude.api_key,
  });

  // Load local CHANGELOG.md if available (benchmark fixtures have curated docs)
  let localDocs = null;
  const changelogPath = join(projectDir, "CHANGELOG.md");
  if (existsSync(changelogPath)) {
    const content = await readFile(changelogPath, "utf-8");
    const deps = await detectDependencies(projectDir, lang);
    const libName = deps[0]?.name || "unknown";
    const libVersion = deps[0]?.version || "unknown";
    localDocs = [{ library: libName, version: libVersion, source: "local_changelog", content }];
  }

  // Build a mock doc retriever that returns the local docs for benchmark
  function makeBenchDocRetriever(docs) {
    return {
      fetchForLibraries: async () => ({
        succeeded: docs || [],
        failed: [],
      }),
    };
  }

  // Configure memory based on condition
  let memoryStore = null;
  if (condition.memory) {
    memoryStore = new MemoryStore({
      config: {
        memory: {
          storage_dir: join(projectDir, `.docaware/bench-memory-${conditionId}`),
          max_context_entries: 10,
        },
      },
      benchmarkLogger,
    });
  }

  // Build reviewer with conditional components
  let reviewer;
  if (condition.docs === false) {
    // Condition A: No docs — LLM sees only code, no documentation
    reviewer = new Reviewer({
      config: { ...config, benchmark: { enabled: true } },
      claudeClient,
      memoryStore: null,
      benchmarkLogger,
      docRetriever: makeBenchDocRetriever([]),
    });
  } else {
    // Conditions B/C/D: LLM sees code + docs (from local CHANGELOG or real retriever)
    const docRetriever = localDocs
      ? makeBenchDocRetriever(localDocs)
      : new DocRetriever({ benchmarkLogger });

    reviewer = new Reviewer({
      config: { ...config, benchmark: { enabled: true } },
      claudeClient,
      memoryStore,
      benchmarkLogger,
      docRetriever,
    });
  }

  // Run review
  const result = await reviewer.review({ projectDir, lang });

  // Analyze results
  const hallucinationMetrics = condition.docs
    ? analyzeHallucinations(result.findings, result._docs || [])
    : { hallucination_rate: "N/A (no docs to ground against)", total_findings: result.findings.length };

  let groundTruthMetrics = null;
  if (groundTruth) {
    groundTruthMetrics = evaluateAgainstGroundTruth(result.findings, groundTruth);
  }

  const conditionResult = {
    condition: conditionId,
    conditionName: condition.name,
    findings_count: result.findings.length,
    stats: result.stats,
    duration_ms: result.duration,
    token_usage: claudeClient.getTokenUsage(),
    hallucination_metrics: hallucinationMetrics,
    ground_truth_metrics: groundTruthMetrics,
    benchmark_events: benchmarkLogger.getEntries(),
    severity_distribution: result.stats?.bySeverity || {},
    category_distribution: result.stats?.byCategory || {},
  };

  return conditionResult;
}

/**
 * Run the full A/B/C/D experiment.
 */
export async function runExperiment({
  projectDir,
  lang = "js",
  config,
  conditions = ["A", "B", "C", "D"],
  groundTruth = null,
  outputDir = ".docaware/benchmarks",
}) {
  const experimentId = `exp-${Date.now()}`;
  const outDir = join(outputDir, experimentId);
  await mkdir(outDir, { recursive: true });

  info(c.bold(`\n  Benchmark Experiment: ${experimentId}`));
  info(c.dim(`  Project: ${projectDir}`));
  info(c.dim(`  Conditions: ${conditions.join(", ")}`));
  info("");

  const results = {};

  for (const condId of conditions) {
    if (!CONDITIONS[condId]) {
      info(c.yellow(`  Skipping unknown condition: ${condId}`));
      continue;
    }

    info(c.cyan(`  Running condition ${condId}: ${CONDITIONS[condId].name}...`));

    try {
      results[condId] = await runCondition(condId, {
        projectDir,
        lang,
        config,
        groundTruth,
      });

      info(`    Findings: ${results[condId].findings_count}`);
      info(`    Duration: ${(results[condId].duration_ms / 1000).toFixed(1)}s`);
      info(`    Tokens: ${results[condId].token_usage.input + results[condId].token_usage.output}`);
      if (results[condId].ground_truth_metrics) {
        const gt = results[condId].ground_truth_metrics;
        info(`    Precision: ${(gt.precision * 100).toFixed(1)}%  Recall: ${(gt.recall * 100).toFixed(1)}%  F1: ${(gt.f1 * 100).toFixed(1)}%`);
      }
      info("");
    } catch (err) {
      info(c.red(`    Error: ${err.message}`));
      results[condId] = { condition: condId, error: err.message };
    }
  }

  // Write results
  const resultsPath = join(outDir, "results.json");
  await writeFile(resultsPath, JSON.stringify(results, null, 2));

  // Write comparison summary
  const summary = buildComparisonTable(results);
  const summaryPath = join(outDir, "summary.md");
  await writeFile(summaryPath, summary);

  // Write JSONL for easy ingestion
  const jsonlPath = join(outDir, "events.jsonl");
  const jsonlLines = [];
  for (const [condId, result] of Object.entries(results)) {
    if (result.benchmark_events) {
      for (const event of result.benchmark_events) {
        jsonlLines.push(JSON.stringify({ condition: condId, ...event }));
      }
    }
  }
  await writeFile(jsonlPath, jsonlLines.join("\n") + "\n");

  info(c.bold("  Results saved to:"));
  info(`    ${resultsPath}`);
  info(`    ${summaryPath}`);
  info(`    ${jsonlPath}`);
  info("");

  return { experimentId, results, outputDir: outDir };
}

/**
 * Build a markdown comparison table from experiment results.
 */
function buildComparisonTable(results) {
  const lines = [];
  lines.push("# Benchmark Experiment Results\n");
  lines.push(`**Date:** ${new Date().toISOString()}\n`);

  // Main comparison table
  lines.push("## Comparison Table\n");
  lines.push("| Metric | A: Baseline | B: Raw Docs | C: Structured Docs | D: Full DocAware |");
  lines.push("|--------|------------|-------------|-------------------|------------------|");

  const metrics = [
    ["Findings", (r) => r?.findings_count ?? "N/A"],
    ["Duration (s)", (r) => r?.duration_ms ? (r.duration_ms / 1000).toFixed(1) : "N/A"],
    ["Input tokens", (r) => r?.token_usage?.input ?? "N/A"],
    ["Output tokens", (r) => r?.token_usage?.output ?? "N/A"],
    ["Critical", (r) => r?.severity_distribution?.critical ?? 0],
    ["High", (r) => r?.severity_distribution?.high ?? 0],
    ["Medium", (r) => r?.severity_distribution?.medium ?? 0],
    ["Low", (r) => r?.severity_distribution?.low ?? 0],
    ["Precision", (r) => r?.ground_truth_metrics ? `${(r.ground_truth_metrics.precision * 100).toFixed(1)}%` : "N/A"],
    ["Recall", (r) => r?.ground_truth_metrics ? `${(r.ground_truth_metrics.recall * 100).toFixed(1)}%` : "N/A"],
    ["F1 Score", (r) => r?.ground_truth_metrics ? `${(r.ground_truth_metrics.f1 * 100).toFixed(1)}%` : "N/A"],
    ["Hallucination Rate", (r) => typeof r?.hallucination_metrics?.hallucination_rate === "number" ? `${(r.hallucination_metrics.hallucination_rate * 100).toFixed(1)}%` : "N/A"],
    ["Grounding Rate", (r) => typeof r?.hallucination_metrics?.grounding_rate === "number" ? `${(r.hallucination_metrics.grounding_rate * 100).toFixed(1)}%` : "N/A"],
  ];

  for (const [name, extract] of metrics) {
    const a = extract(results.A);
    const b = extract(results.B);
    const cc = extract(results.C);
    const d = extract(results.D);
    lines.push(`| ${name} | ${a} | ${b} | ${cc} | ${d} |`);
  }

  lines.push("");

  // Per-condition details
  for (const [condId, result] of Object.entries(results)) {
    if (result.error) {
      lines.push(`## Condition ${condId}: Error\n`);
      lines.push(`\`${result.error}\`\n`);
      continue;
    }

    lines.push(`## Condition ${condId}: ${result.conditionName}\n`);
    lines.push(`- Findings: ${result.findings_count}`);
    lines.push(`- Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
    lines.push(`- Tokens: ${result.token_usage?.input || 0} in / ${result.token_usage?.output || 0} out`);

    if (result.category_distribution) {
      lines.push("\nCategory breakdown:");
      for (const [cat, count] of Object.entries(result.category_distribution)) {
        lines.push(`  - ${cat}: ${count}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Run a migration benchmark.
 */
export async function runMigrationBenchmark({
  library,
  oldVersion,
  newVersion,
  projectDir,
  lang = "js",
  config,
  outputDir = ".docaware/benchmarks",
}) {
  const benchmarkLogger = new BenchmarkLogger(true);
  const experimentId = `migrate-bench-${Date.now()}`;
  const outDir = join(outputDir, experimentId);
  await mkdir(outDir, { recursive: true });

  info(c.bold(`\n  Migration Benchmark: ${library} v${oldVersion} -> v${newVersion}`));

  // Run with LLM
  const claudeClient = await createLLMClient({
    provider: config.llm?.provider,
    model: config.llm?.model || config.claude.model,
    max_tokens: config.llm?.max_tokens || config.claude.max_tokens,
    api_key: config.llm?.api_key || config.claude.api_key,
  });

  const migrator = new Migrator({
    config,
    claudeClient,
    benchmarkLogger,
  });

  const withLlm = await migrator.migrate({
    library, oldVersion, newVersion, projectDir, lang, noLlm: false,
  });

  // Run without LLM
  const migratorNoLlm = new Migrator({
    config,
    benchmarkLogger,
  });

  const withoutLlm = await migratorNoLlm.migrate({
    library, oldVersion, newVersion, projectDir, lang, noLlm: true,
  });

  const results = {
    library,
    oldVersion,
    newVersion,
    with_llm: {
      breaking_changes: withLlm.changes.removed.length + withLlm.changes.changed.length,
      affected_files: withLlm.scanResults.length,
      migration_steps: withLlm.migrationPlan?.steps.length || 0,
      estimated_effort: withLlm.migrationPlan?.estimatedEffort || "N/A",
      duration_ms: withLlm.duration,
    },
    without_llm: {
      breaking_changes: withoutLlm.changes.removed.length + withoutLlm.changes.changed.length,
      affected_files: withoutLlm.scanResults.length,
      duration_ms: withoutLlm.duration,
    },
    token_usage: claudeClient.getTokenUsage(),
  };

  await writeFile(join(outDir, "results.json"), JSON.stringify(results, null, 2));

  info(`  Results saved to: ${outDir}/results.json`);
  return results;
}

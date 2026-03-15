/**
 * Benchmark analysis script.
 * Reads experiment results and generates paper-ready statistics.
 *
 * Usage: node lib/benchmark/analyze.js <results-dir>
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Aggregate results across multiple experiment runs.
 */
export function aggregateExperiments(experiments) {
  const conditions = ["A", "B", "C", "D"];
  const aggregated = {};

  for (const cond of conditions) {
    const runs = experiments
      .map((exp) => exp[cond])
      .filter((r) => r && !r.error);

    if (runs.length === 0) {
      aggregated[cond] = { runs: 0, message: "No data" };
      continue;
    }

    aggregated[cond] = {
      runs: runs.length,
      findings: {
        mean: mean(runs.map((r) => r.findings_count)),
        std: std(runs.map((r) => r.findings_count)),
        min: Math.min(...runs.map((r) => r.findings_count)),
        max: Math.max(...runs.map((r) => r.findings_count)),
      },
      duration_ms: {
        mean: mean(runs.map((r) => r.duration_ms)),
        std: std(runs.map((r) => r.duration_ms)),
      },
      tokens: {
        mean_input: mean(runs.map((r) => r.token_usage?.input || 0)),
        mean_output: mean(runs.map((r) => r.token_usage?.output || 0)),
      },
      precision: aggregateMetric(runs, (r) => r.ground_truth_metrics?.precision),
      recall: aggregateMetric(runs, (r) => r.ground_truth_metrics?.recall),
      f1: aggregateMetric(runs, (r) => r.ground_truth_metrics?.f1),
      hallucination_rate: aggregateMetric(runs, (r) => {
        const rate = r.hallucination_metrics?.hallucination_rate;
        return typeof rate === "number" ? rate : null;
      }),
      grounding_rate: aggregateMetric(runs, (r) => {
        const rate = r.hallucination_metrics?.grounding_rate;
        return typeof rate === "number" ? rate : null;
      }),
    };
  }

  return aggregated;
}

function aggregateMetric(runs, extract) {
  const values = runs.map(extract).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return null;
  return {
    mean: mean(values),
    std: std(values),
    n: values.length,
  };
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

/**
 * Generate a LaTeX table from aggregated results.
 */
export function generateLatexTable(aggregated) {
  const lines = [];
  lines.push("\\begin{table}[h]");
  lines.push("\\centering");
  lines.push("\\caption{Comparison of experimental conditions}");
  lines.push("\\label{tab:results}");
  lines.push("\\begin{tabular}{lcccc}");
  lines.push("\\hline");
  lines.push("\\textbf{Metric} & \\textbf{A: Baseline} & \\textbf{B: Raw Docs} & \\textbf{C: Structured} & \\textbf{D: Full} \\\\");
  lines.push("\\hline");

  const row = (label, extract, fmt = (v) => v.toFixed(1)) => {
    const vals = ["A", "B", "C", "D"].map((c) => {
      const d = aggregated[c];
      if (!d || d.message) return "---";
      const v = extract(d);
      if (v === null || v === undefined) return "---";
      return fmt(v);
    });
    lines.push(`${label} & ${vals.join(" & ")} \\\\`);
  };

  row("Findings (mean)", (d) => d.findings?.mean, (v) => v.toFixed(1));
  row("Precision (\\%)", (d) => d.precision?.mean ? d.precision.mean * 100 : null, (v) => v.toFixed(1));
  row("Recall (\\%)", (d) => d.recall?.mean ? d.recall.mean * 100 : null, (v) => v.toFixed(1));
  row("F1 Score (\\%)", (d) => d.f1?.mean ? d.f1.mean * 100 : null, (v) => v.toFixed(1));
  row("Hallucination Rate (\\%)", (d) => d.hallucination_rate?.mean ? d.hallucination_rate.mean * 100 : null, (v) => v.toFixed(1));
  row("Grounding Rate (\\%)", (d) => d.grounding_rate?.mean ? d.grounding_rate.mean * 100 : null, (v) => v.toFixed(1));
  row("Duration (s)", (d) => d.duration_ms?.mean ? d.duration_ms.mean / 1000 : null, (v) => v.toFixed(1));
  row("Input Tokens", (d) => d.tokens?.mean_input, (v) => Math.round(v).toString());

  lines.push("\\hline");
  lines.push("\\end{tabular}");
  lines.push("\\end{table}");

  return lines.join("\n");
}

/**
 * Generate markdown summary with key insights.
 */
export function generateAnalysisSummary(aggregated) {
  const lines = [];
  lines.push("# Benchmark Analysis Summary\n");

  // Check if we have data
  const hasData = Object.values(aggregated).some((a) => a.runs > 0);
  if (!hasData) {
    lines.push("No experiment data found.\n");
    return lines.join("\n");
  }

  lines.push("## Key Findings\n");

  // Compare hallucination rates
  if (aggregated.A?.hallucination_rate?.mean != null && aggregated.D?.hallucination_rate?.mean != null) {
    const reduction = ((aggregated.A.hallucination_rate.mean - aggregated.D.hallucination_rate.mean) / aggregated.A.hallucination_rate.mean * 100);
    lines.push(`1. **Hallucination reduction:** ${reduction.toFixed(1)}% reduction from baseline (A) to full DocAware (D)`);
  }

  // Compare F1 scores
  if (aggregated.A?.f1?.mean != null && aggregated.D?.f1?.mean != null) {
    const improvement = ((aggregated.D.f1.mean - aggregated.A.f1.mean) / (aggregated.A.f1.mean || 0.01) * 100);
    lines.push(`2. **F1 improvement:** ${improvement.toFixed(1)}% improvement from baseline to full pipeline`);
  }

  // Compare structured vs raw docs
  if (aggregated.B?.f1?.mean != null && aggregated.C?.f1?.mean != null) {
    const structuredGain = ((aggregated.C.f1.mean - aggregated.B.f1.mean) * 100);
    lines.push(`3. **Structured vs raw docs:** ${structuredGain.toFixed(1)} percentage point F1 gain`);
  }

  // Memory contribution
  if (aggregated.C?.f1?.mean != null && aggregated.D?.f1?.mean != null) {
    const memoryGain = ((aggregated.D.f1.mean - aggregated.C.f1.mean) * 100);
    lines.push(`4. **Memory layer contribution:** ${memoryGain.toFixed(1)} percentage point F1 gain from memory`);
  }

  lines.push("");
  lines.push("## Aggregated Results\n");
  lines.push("| Condition | Runs | Findings | Precision | Recall | F1 | Halluc. Rate |");
  lines.push("|-----------|------|----------|-----------|--------|----|----|");

  for (const cond of ["A", "B", "C", "D"]) {
    const d = aggregated[cond];
    if (!d || d.message) {
      lines.push(`| ${cond} | 0 | --- | --- | --- | --- | --- |`);
      continue;
    }
    lines.push(`| ${cond} | ${d.runs} | ${d.findings?.mean?.toFixed(1) || "---"} | ${d.precision?.mean ? (d.precision.mean * 100).toFixed(1) + "%" : "---"} | ${d.recall?.mean ? (d.recall.mean * 100).toFixed(1) + "%" : "---"} | ${d.f1?.mean ? (d.f1.mean * 100).toFixed(1) + "%" : "---"} | ${d.hallucination_rate?.mean ? (d.hallucination_rate.mean * 100).toFixed(1) + "%" : "---"} |`);
  }

  lines.push("");
  return lines.join("\n");
}

// CLI entry point — only run when executed directly (not when imported)
const isMain = process.argv[1]?.endsWith("analyze.js");
if (isMain && process.argv.length > 2) {
  const args = process.argv.slice(2);
  (async () => {
    const dir = args[0];
    /* eslint-disable no-inner-declarations */
    const experiments = [];

    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        try {
          const resultsPath = join(dir, entry, "results.json");
          const data = JSON.parse(await readFile(resultsPath, "utf-8"));
          experiments.push(data);
        } catch {
          // Skip non-experiment directories
        }
      }
    } catch (err) {
      console.error(`Failed to read results directory: ${err.message}`);
      process.exit(1);
    }

    if (experiments.length === 0) {
      console.error("No experiment results found.");
      process.exit(1);
    }

    console.log(`Found ${experiments.length} experiment(s)\n`);

    const aggregated = aggregateExperiments(experiments);
    console.log(generateAnalysisSummary(aggregated));
    console.log("\n--- LaTeX Table ---\n");
    console.log(generateLatexTable(aggregated));
  })();
}

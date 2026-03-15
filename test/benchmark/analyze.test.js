import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateExperiments,
  generateLatexTable,
  generateAnalysisSummary,
} from "../../lib/benchmark/analyze.js";

describe("aggregateExperiments", () => {
  it("aggregates multiple experiment runs", () => {
    const experiments = [
      {
        A: {
          findings_count: 10,
          duration_ms: 5000,
          token_usage: { input: 1000, output: 200 },
          ground_truth_metrics: { precision: 0.6, recall: 0.5, f1: 0.55 },
          hallucination_metrics: { hallucination_rate: 0.4, grounding_rate: 0.6 },
          severity_distribution: { high: 3, medium: 5, low: 2 },
          category_distribution: { deprecated_api: 4, security: 6 },
        },
        D: {
          findings_count: 8,
          duration_ms: 8000,
          token_usage: { input: 2000, output: 400 },
          ground_truth_metrics: { precision: 0.9, recall: 0.85, f1: 0.87 },
          hallucination_metrics: { hallucination_rate: 0.1, grounding_rate: 0.9 },
          severity_distribution: { high: 4, medium: 3, low: 1 },
          category_distribution: { deprecated_api: 5, security: 3 },
        },
      },
    ];

    const agg = aggregateExperiments(experiments);
    assert.equal(agg.A.runs, 1);
    assert.equal(agg.D.runs, 1);
    assert.equal(agg.A.findings.mean, 10);
    assert.equal(agg.D.findings.mean, 8);
    assert.ok(agg.D.f1.mean > agg.A.f1.mean);
    assert.ok(agg.D.hallucination_rate.mean < agg.A.hallucination_rate.mean);
  });

  it("handles missing conditions", () => {
    const experiments = [
      { A: { findings_count: 5, duration_ms: 1000, token_usage: { input: 500, output: 100 } } },
    ];

    const agg = aggregateExperiments(experiments);
    assert.equal(agg.A.runs, 1);
    assert.equal(agg.B.runs, 0);
    assert.equal(agg.C.runs, 0);
    assert.equal(agg.D.runs, 0);
  });
});

describe("generateLatexTable", () => {
  it("generates valid LaTeX", () => {
    const agg = {
      A: { runs: 1, findings: { mean: 10 }, duration_ms: { mean: 5000 }, tokens: { mean_input: 1000, mean_output: 200 }, precision: { mean: 0.6 }, recall: { mean: 0.5 }, f1: { mean: 0.55 }, hallucination_rate: { mean: 0.4 }, grounding_rate: { mean: 0.6 } },
      B: { runs: 0, message: "No data" },
      C: { runs: 0, message: "No data" },
      D: { runs: 1, findings: { mean: 8 }, duration_ms: { mean: 8000 }, tokens: { mean_input: 2000, mean_output: 400 }, precision: { mean: 0.9 }, recall: { mean: 0.85 }, f1: { mean: 0.87 }, hallucination_rate: { mean: 0.1 }, grounding_rate: { mean: 0.9 } },
    };

    const latex = generateLatexTable(agg);
    assert.ok(latex.includes("\\begin{table}"));
    assert.ok(latex.includes("\\end{table}"));
    assert.ok(latex.includes("Baseline"));
    assert.ok(latex.includes("Full"));
  });
});

describe("generateAnalysisSummary", () => {
  it("generates markdown summary", () => {
    const agg = {
      A: { runs: 1, findings: { mean: 10 }, hallucination_rate: { mean: 0.4 }, f1: { mean: 0.55 }, precision: { mean: 0.6 }, recall: { mean: 0.5 } },
      B: { runs: 0, message: "No data" },
      C: { runs: 0, message: "No data" },
      D: { runs: 1, findings: { mean: 8 }, hallucination_rate: { mean: 0.1 }, f1: { mean: 0.87 }, precision: { mean: 0.9 }, recall: { mean: 0.85 } },
    };

    const md = generateAnalysisSummary(agg);
    assert.ok(md.includes("Key Findings"));
    assert.ok(md.includes("Hallucination reduction"));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatOutput } from "../../lib/output/reporter.js";

describe("formatOutput", () => {
  const mockReviewResult = {
    findings: [
      {
        id: "abc123",
        file: "src/app.js",
        line: 42,
        severity: "high",
        category: "deprecated_api",
        library: "openai",
        apiName: "ChatCompletion.create",
        message: "Deprecated API usage",
        suggestion: "Use client.chat.completions.create()",
        docReference: "See migration guide",
        confidence: 0.9,
      },
    ],
    stats: {
      total: 1,
      bySeverity: { low: 0, medium: 0, high: 1, critical: 0 },
      byCategory: { deprecated_api: 1 },
      filesAffected: 1,
      avgConfidence: 0.9,
    },
    summary: "Found 1 issue",
    docs: { fetched: ["openai@4.20.0"], failed: [] },
    duration: 1500,
  };

  it("formats review as terminal output", () => {
    const output = formatOutput("review", mockReviewResult, "terminal");
    assert.ok(output.includes("Code Review"));
    assert.ok(output.includes("src/app.js:42"));
    assert.ok(output.includes("Deprecated API"));
  });

  it("formats review as JSON", () => {
    const output = formatOutput("review", mockReviewResult, "json");
    const parsed = JSON.parse(output);
    assert.equal(parsed.findings.length, 1);
    assert.equal(parsed.stats.total, 1);
  });

  it("formats review as markdown", () => {
    const output = formatOutput("review", mockReviewResult, "markdown");
    assert.ok(output.includes("# DocAware AI Code Review Report"));
    assert.ok(output.includes("| Severity |"));
  });

  it("formats memory search results", () => {
    const entries = [
      { type: "review_finding", content: "Test finding", score: 0.85 },
    ];
    const output = formatOutput("memory_search", entries, "terminal");
    assert.ok(output.includes("85%"));
    assert.ok(output.includes("Test finding"));
  });

  it("throws for unknown format", () => {
    assert.throws(() => formatOutput("review", {}, "unknown"));
  });
});

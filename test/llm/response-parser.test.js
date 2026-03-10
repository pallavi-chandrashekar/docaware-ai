import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseReviewResponse,
  parseMigrationResponse,
  filterBySeverity,
  deduplicateFindings,
} from "../../lib/llm/response-parser.js";

describe("parseReviewResponse", () => {
  it("parses valid findings", () => {
    const input = {
      findings: [
        {
          file: "src/app.js",
          line: 42,
          severity: "high",
          category: "deprecated_api",
          message: "Using deprecated API",
          confidence: 0.9,
          apiName: "oldMethod",
          library: "express",
        },
      ],
      summary: "Found 1 issue",
    };

    const result = parseReviewResponse(input);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, "high");
    assert.equal(result.findings[0].category, "deprecated_api");
    assert.ok(result.findings[0].id); // Should have generated ID
    assert.equal(result.summary, "Found 1 issue");
  });

  it("normalizes invalid severity", () => {
    const input = {
      findings: [{ file: "a.js", line: 1, severity: "EXTREME", category: "security", message: "bad", confidence: 0.5 }],
      summary: "",
    };
    const result = parseReviewResponse(input);
    assert.equal(result.findings[0].severity, "medium"); // Fallback
  });

  it("handles null/empty input", () => {
    assert.equal(parseReviewResponse(null).findings.length, 0);
    assert.equal(parseReviewResponse({}).findings.length, 0);
  });
});

describe("parseMigrationResponse", () => {
  it("parses valid migration plan", () => {
    const input = {
      steps: [
        { order: 1, description: "Update imports", risk: "low" },
        { order: 2, description: "Change API calls", risk: "medium", oldCode: "old()", newCode: "new()" },
      ],
      estimatedEffort: "small",
      risks: ["Data format changed"],
      summary: "2 steps needed",
    };

    const result = parseMigrationResponse(input);
    assert.equal(result.steps.length, 2);
    assert.equal(result.estimatedEffort, "small");
    assert.equal(result.risks.length, 1);
  });

  it("handles empty input", () => {
    const result = parseMigrationResponse(null);
    assert.equal(result.steps.length, 0);
    assert.equal(result.estimatedEffort, "unknown");
  });
});

describe("filterBySeverity", () => {
  const findings = [
    { id: "1", severity: "low", confidence: 0.5 },
    { id: "2", severity: "medium", confidence: 0.6 },
    { id: "3", severity: "high", confidence: 0.8 },
    { id: "4", severity: "critical", confidence: 0.95 },
  ];

  it("filters by threshold", () => {
    assert.equal(filterBySeverity(findings, "high").length, 2);
    assert.equal(filterBySeverity(findings, "medium").length, 3);
    assert.equal(filterBySeverity(findings, "low").length, 4);
  });
});

describe("deduplicateFindings", () => {
  it("removes duplicates by ID", () => {
    const findings = [
      { id: "abc", message: "first" },
      { id: "abc", message: "duplicate" },
      { id: "def", message: "unique" },
    ];
    const result = deduplicateFindings(findings);
    assert.equal(result.length, 2);
  });
});

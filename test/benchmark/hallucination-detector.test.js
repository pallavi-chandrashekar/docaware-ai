import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDocApiIndex,
  isGrounded,
  analyzeHallucinations,
  evaluateAgainstGroundTruth,
} from "../../lib/benchmark/hallucination-detector.js";

describe("buildDocApiIndex", () => {
  it("builds an index from doc content", () => {
    const docs = [
      {
        library: "openai",
        version: "4.0",
        content: "# OpenAI v4\n## Chat Completions\nUse `client.chat.completions.create()` for chat.\n\n```js\nclient.chat.completions.create({ model: 'gpt-4' })\n```",
      },
    ];

    const index = buildDocApiIndex(docs);
    assert.ok(index.size > 0);
    assert.ok(index.has("client.chat.completions.create"));
  });
});

describe("isGrounded", () => {
  const docs = [
    {
      library: "openai",
      version: "4.0",
      content: "Use `client.chat.completions.create()` and `client.embeddings.create()`.",
    },
  ];
  const index = buildDocApiIndex(docs);

  it("detects exact match as grounded", () => {
    const result = isGrounded({ apiName: "client.chat.completions.create" }, index);
    assert.equal(result.grounded, true);
    assert.equal(result.type, "exact");
  });

  it("detects suffix match as grounded", () => {
    const result = isGrounded({ apiName: "openai.client.chat.completions.create" }, index);
    assert.equal(result.grounded, true);
  });

  it("detects ungrounded finding", () => {
    const result = isGrounded({ apiName: "nonexistent.method" }, index);
    assert.equal(result.grounded, false);
  });

  it("handles missing apiName", () => {
    const result = isGrounded({}, index);
    assert.equal(result.grounded, false);
    assert.equal(result.reason, "no_api_name");
  });
});

describe("analyzeHallucinations", () => {
  it("calculates hallucination metrics", () => {
    const findings = [
      { id: "1", apiName: "client.chat.completions.create", confidence: 0.9 },
      { id: "2", apiName: "totally.made.up.api", confidence: 0.7 },
      { id: "3", apiName: "client.embeddings.create", confidence: 0.85 },
    ];
    const docs = [
      {
        library: "openai",
        version: "4.0",
        content: "Use `client.chat.completions.create()` and `client.embeddings.create()`.",
      },
    ];

    const result = analyzeHallucinations(findings, docs);
    assert.equal(result.total_findings, 3);
    assert.equal(result.grounded, 2);
    assert.equal(result.hallucinated, 1);
    assert.ok(result.hallucination_rate > 0.3);
    assert.ok(result.grounding_rate > 0.6);
  });
});

describe("evaluateAgainstGroundTruth", () => {
  it("calculates precision, recall, F1", () => {
    const findings = [
      { file: "a.js", line: 1, apiName: "foo" },      // True positive
      { file: "a.js", line: 2, apiName: "bar" },      // True positive
      { file: "a.js", line: 50, apiName: "phantom" }, // False positive (far from any truth)
    ];
    const groundTruth = [
      { file: "a.js", line: 1, apiName: "foo", isReal: true },
      { file: "a.js", line: 2, apiName: "bar", isReal: true },
      { file: "a.js", line: 30, apiName: "baz", isReal: true },  // Missed (no matching finding)
      { file: "a.js", line: 40, apiName: "safe", isReal: false }, // Not a real issue
    ];

    const result = evaluateAgainstGroundTruth(findings, groundTruth);
    assert.equal(result.truePositives, 2);
    assert.equal(result.falsePositives, 1);
    assert.equal(result.falseNegatives, 1);
    assert.ok(result.precision > 0.6 && result.precision < 0.7);
    assert.ok(result.recall > 0.6 && result.recall < 0.7);
    assert.ok(result.f1 > 0);
  });

  it("handles perfect results", () => {
    const findings = [
      { file: "a.js", line: 1, apiName: "foo" },
    ];
    const groundTruth = [
      { file: "a.js", line: 1, apiName: "foo", isReal: true },
    ];

    const result = evaluateAgainstGroundTruth(findings, groundTruth);
    assert.equal(result.precision, 1);
    assert.equal(result.recall, 1);
    assert.equal(result.f1, 1);
  });
});

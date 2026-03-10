import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  diffDocs,
  splitSections,
  extractApiSignatures,
  extractApiNames,
  similarity,
  headingSimilarity,
} from "../../lib/analysis/diff-engine.js";

describe("splitSections", () => {
  it("splits markdown by headings", () => {
    const md = `# Title\nIntro text\n## Section A\nContent A\n## Section B\nContent B`;
    const sections = splitSections(md);
    assert.equal(sections.length, 3);
    assert.equal(sections[0].heading, "Title");
    assert.equal(sections[1].heading, "Section A");
    assert.equal(sections[2].heading, "Section B");
  });

  it("handles empty input", () => {
    const sections = splitSections("");
    assert.equal(sections.length, 0);
  });

  it("preserves heading levels", () => {
    const md = `# H1\n\n## H2\n\n### H3`;
    const sections = splitSections(md);
    assert.equal(sections[0].level, 1);
    assert.equal(sections[1].level, 2);
    assert.equal(sections[2].level, 3);
  });
});

describe("extractApiNames", () => {
  it("extracts inline code identifiers", () => {
    const content = "Use `fetchData()` and `config.timeout` to configure.";
    const names = extractApiNames(content);
    assert.ok(names.includes("fetchData"));
    assert.ok(names.includes("config.timeout"));
  });

  it("extracts from code blocks", () => {
    const content = "```js\nclient.chat.completions.create(params)\n```";
    const names = extractApiNames(content);
    assert.ok(names.includes("client.chat.completions.create"));
  });
});

describe("extractApiSignatures", () => {
  it("extracts JS function declarations", () => {
    const content = "```js\nfunction createClient(apiKey, options) {\n  // ...\n}\n```";
    const sigs = extractApiSignatures(content);
    assert.ok(sigs.some((s) => s.name === "createClient" && s.type === "function"));
  });

  it("extracts Python function defs", () => {
    const content = "```python\ndef create_completion(prompt, model='gpt-4'):\n    pass\n```";
    const sigs = extractApiSignatures(content);
    assert.ok(sigs.some((s) => s.name === "create_completion" && s.type === "function"));
  });

  it("extracts class declarations", () => {
    const content = "```js\nclass OpenAI extends BaseClient {\n}\n```";
    const sigs = extractApiSignatures(content);
    assert.ok(sigs.some((s) => s.name === "OpenAI" && s.type === "class"));
  });
});

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    assert.equal(similarity("hello", "hello"), 1);
  });

  it("returns 0 for completely different strings", () => {
    const score = similarity("abc", "xyz");
    assert.ok(score < 0.3);
  });

  it("returns high score for similar strings", () => {
    const score = similarity("createClient", "createCustomClient");
    assert.ok(score > 0.5);
  });
});

describe("headingSimilarity", () => {
  it("matches headings with shared words", () => {
    const score = headingSimilarity("Client Setup", "Client Configuration");
    assert.ok(score > 0.3);
  });
});

describe("diffDocs", () => {
  it("detects removed sections", () => {
    const oldMd = "# API\n## Auth\nAuth content\n## Billing\nBilling content";
    const newMd = "# API\n## Auth\nAuth content";
    const result = diffDocs(oldMd, newMd);
    assert.ok(result.removed.some((r) => r.heading === "Billing"));
  });

  it("detects changed sections", () => {
    const oldMd = "# API\n## Auth\nOld auth content";
    const newMd = "# API\n## Auth\nNew auth content with changes";
    const result = diffDocs(oldMd, newMd);
    assert.ok(result.changed.some((c) => c.heading === "Auth"));
  });

  it("detects added sections", () => {
    const oldMd = "# API\n## Auth\nAuth content";
    const newMd = "# API\n## Auth\nAuth content\n## Streaming\nNew streaming API";
    const result = diffDocs(oldMd, newMd);
    assert.ok(result.added.some((a) => a.heading === "Streaming"));
  });

  it("detects migration keywords", () => {
    const oldMd = "# API\n## Auth\nOld auth";
    const newMd = "# API\n## Auth\nThis method is deprecated, use newAuth() instead";
    const result = diffDocs(oldMd, newMd);
    assert.ok(result.keywords.some((k) => k.term === "deprecated"));
  });

  it("handles fuzzy section matching", () => {
    const oldMd = "# API\n## Client Setup\nSetup content";
    const newMd = "# API\n## Client Configuration\nNew config content";
    const result = diffDocs(oldMd, newMd);
    // Should be detected as changed, not removed+added
    assert.equal(result.removed.length, 0);
    assert.ok(result.changed.some((c) => c.headingRenamed !== null));
  });
});

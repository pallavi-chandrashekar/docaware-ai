import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Reviewer } from "../../lib/review/reviewer.js";

describe("Reviewer", () => {
  const testDir = join(tmpdir(), `docaware-review-test-${Date.now()}`);
  const srcDir = join(testDir, "src");

  // Mock Claude client
  const mockClaudeClient = {
    structuredOutput: async () => ({
      findings: [
        {
          file: join(srcDir, "app.js"),
          line: 2,
          severity: "high",
          category: "deprecated_api",
          library: "openai",
          apiName: "ChatCompletion.create",
          message: "ChatCompletion.create is deprecated in openai v4. Use client.chat.completions.create() instead.",
          suggestion: "Replace with: const response = await openai.chat.completions.create({...})",
          confidence: 0.92,
        },
      ],
      summary: "Found 1 deprecated API usage",
    }),
    getTokenUsage: () => ({ input: 1000, output: 200 }),
  };

  // Mock doc retriever
  const mockDocRetriever = {
    fetchForLibraries: async () => ({
      succeeded: [
        {
          library: "openai",
          version: "4.20.0",
          source: "mock",
          content: "# openai v4\n## Chat Completions\nUse `client.chat.completions.create()`\n\n`ChatCompletion.create()` is deprecated.",
        },
      ],
      failed: [],
    }),
  };

  before(async () => {
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      join(testDir, "package.json"),
      JSON.stringify({
        dependencies: { openai: "^4.20.0" },
      })
    );
    await writeFile(
      join(srcDir, "app.js"),
      `import OpenAI from 'openai';\nconst result = OpenAI.ChatCompletion.create({ model: "gpt-4" });\nconsole.log(result);\n`
    );
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("runs a full review with mock LLM", async () => {
    const reviewer = new Reviewer({
      config: { review: { severity_threshold: "low" } },
      claudeClient: mockClaudeClient,
      docRetriever: mockDocRetriever,
    });

    const result = await reviewer.review({
      projectDir: testDir,
      lang: "js",
    });

    assert.ok(result.findings.length >= 1);
    assert.ok(result.stats.total >= 1);
    assert.ok(result.duration > 0);
    assert.ok(result.findings[0].category === "deprecated_api");
  });
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../../lib/memory/memory-store.js";
import { EmbeddingProvider } from "../../lib/memory/embeddings.js";

describe("MemoryStore", () => {
  const testDir = join(tmpdir(), `docaware-memory-test-${Date.now()}`);

  // Use deterministic mock embedder for tests
  const mockEmbedder = new EmbeddingProvider({
    embedFn: async (text) => {
      // Simple deterministic embedding based on character codes
      const vec = new Array(64).fill(0);
      for (let i = 0; i < text.length; i++) {
        vec[i % 64] += text.charCodeAt(i) / 256;
      }
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    },
  });

  const config = {
    memory: {
      storage_dir: testDir,
      max_context_entries: 5,
    },
  };

  let store;

  before(async () => {
    await mkdir(testDir, { recursive: true });
    store = new MemoryStore({ config, embeddingProvider: mockEmbedder });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("stores and recalls a memory", async () => {
    await store.remember({
      type: "review_finding",
      library: "openai",
      content: "The openai.ChatCompletion.create() method is deprecated in v4",
      tags: ["deprecated", "openai"],
    });

    const results = await store.recall("openai deprecated API", 3);
    assert.ok(results.length > 0);
    assert.ok(results[0].content.includes("deprecated"));
  });

  it("stores multiple entries and searches", async () => {
    await store.remember({
      type: "migration_decision",
      library: "stripe",
      content: "Stripe webhook verification requires raw body",
      tags: ["stripe", "webhook"],
    });

    await store.remember({
      type: "pattern",
      content: "Always validate API responses before using them",
      tags: ["best-practice"],
    });

    const results = await store.recall("stripe webhook", 5);
    assert.ok(results.length >= 1);
  });

  it("lists entries with filters", async () => {
    const all = await store.list();
    assert.ok(all.length >= 3);

    const migrations = await store.list({ type: "migration_decision" });
    assert.ok(migrations.every((e) => e.type === "migration_decision"));
  });

  it("reports stats", async () => {
    const stats = await store.stats();
    assert.ok(stats.totalEntries >= 3);
    assert.ok(stats.byType.review_finding >= 1);
  });

  it("forgets a memory", async () => {
    const entry = await store.remember({
      type: "custom",
      content: "Temporary memory to delete",
    });

    const deleted = await store.forget(entry.id);
    assert.equal(deleted, true);

    const results = await store.list();
    assert.ok(!results.some((e) => e.id === entry.id));
  });

  it("clears entries", async () => {
    const count = await store.clear({ type: "pattern" });
    assert.ok(count >= 1);

    const remaining = await store.list({ type: "pattern" });
    assert.equal(remaining.length, 0);
  });
});

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { EmbeddingProvider } from "./embeddings.js";

/**
 * Local vector storage for memory entries.
 * Uses a simple JSON-backed index with cosine similarity search.
 * No external vector DB required — designed for per-project scale
 * (hundreds to low thousands of entries).
 */
export class VectorIndex {
  constructor({ storageDir, embeddingProvider }) {
    this.storageDir = storageDir;
    this.embedder = embeddingProvider || new EmbeddingProvider();
    this.indexPath = join(storageDir, "vectors.json");
    this.entries = null; // Lazy loaded
  }

  async _ensureDir() {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true });
    }
  }

  async _load() {
    if (this.entries !== null) return;

    try {
      const data = await readFile(this.indexPath, "utf-8");
      this.entries = JSON.parse(data);
    } catch {
      this.entries = [];
    }
  }

  async _save() {
    await this._ensureDir();
    await writeFile(this.indexPath, JSON.stringify(this.entries, null, 2));
  }

  /**
   * Add an entry to the index.
   */
  async addEntry(entry) {
    await this._load();
    await this._ensureDir();

    const vector = await this.embedder.embed(entry.content);

    this.entries.push({
      ...entry,
      _vector: vector,
    });

    await this._save();
    return entry.id;
  }

  /**
   * Semantic search: find the top-K most similar entries.
   */
  async search(query, topK = 5, filters = {}) {
    await this._load();

    if (this.entries.length === 0) return [];

    const queryVector = await this.embedder.embed(query);

    let candidates = this.entries;

    // Apply filters
    if (filters.type) {
      candidates = candidates.filter((e) => e.type === filters.type);
    }
    if (filters.library) {
      candidates = candidates.filter((e) => e.library === filters.library);
    }
    if (filters.project) {
      candidates = candidates.filter((e) => e.project === filters.project);
    }

    // Compute cosine similarity
    const scored = candidates.map((entry) => ({
      ...entry,
      score: cosineSimilarity(queryVector, entry._vector),
    }));

    // Sort by score descending, return top K
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(({ _vector, ...rest }) => rest);
  }

  /**
   * Delete an entry by ID.
   */
  async deleteEntry(id) {
    await this._load();
    const initialLen = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);

    if (this.entries.length < initialLen) {
      await this._save();
      return true;
    }
    return false;
  }

  /**
   * List entries with optional filters.
   */
  async listEntries(filters = {}) {
    await this._load();

    let results = this.entries;

    if (filters.type) {
      results = results.filter((e) => e.type === filters.type);
    }
    if (filters.library) {
      results = results.filter((e) => e.library === filters.library);
    }
    if (filters.before) {
      const cutoff = new Date(filters.before);
      results = results.filter((e) => new Date(e.timestamp) < cutoff);
    }

    return results.map(({ _vector, ...rest }) => rest);
  }

  /**
   * Clear entries matching filters, or all entries.
   */
  async clear(filters = {}) {
    await this._load();

    if (Object.keys(filters).length === 0) {
      const count = this.entries.length;
      this.entries = [];
      await this._save();
      return count;
    }

    const initialLen = this.entries.length;

    if (filters.type) {
      this.entries = this.entries.filter((e) => e.type !== filters.type);
    }
    if (filters.before) {
      const cutoff = new Date(filters.before);
      this.entries = this.entries.filter((e) => new Date(e.timestamp) >= cutoff);
    }

    const removed = initialLen - this.entries.length;
    if (removed > 0) await this._save();
    return removed;
  }

  /**
   * Get index statistics.
   */
  async stats() {
    await this._load();

    const typeCounts = {};
    for (const entry of this.entries) {
      typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
    }

    return {
      totalEntries: this.entries.length,
      byType: typeCounts,
      storageDir: this.storageDir,
    };
  }
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

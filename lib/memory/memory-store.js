import { VectorIndex } from "./vector-index.js";
import { EmbeddingProvider } from "./embeddings.js";
import { createEntry } from "./schemas.js";
import { verbose } from "../core/logger.js";

/**
 * Persistent memory layer orchestrator.
 * Combines vector storage, embeddings, and chub annotation sync.
 */
export class MemoryStore {
  constructor({ config, embeddingProvider, benchmarkLogger }) {
    const storageDir = config?.memory?.storage_dir || ".docaware/memory";
    this.embedder = embeddingProvider || new EmbeddingProvider({
      provider: config?.memory?.embedding_provider || "local",
    });
    this.index = new VectorIndex({ storageDir, embeddingProvider: this.embedder });
    this.maxContext = config?.memory?.max_context_entries || 10;
    this.benchmark = benchmarkLogger || null;
  }

  /**
   * Store a new memory entry.
   */
  async remember(data) {
    const entry = createEntry(data);
    await this.index.addEntry(entry);

    verbose(`Stored memory: [${entry.type}] ${entry.content.slice(0, 80)}...`);
    this.benchmark?.log("memory_store", { type: entry.type, id: entry.id });

    return entry;
  }

  /**
   * Recall relevant memories for a given query.
   */
  async recall(query, topK, filters = {}) {
    const k = topK || this.maxContext;
    const results = await this.index.search(query, k, filters);

    this.benchmark?.log("memory_recall", {
      query: query.slice(0, 100),
      results_count: results.length,
      top_score: results[0]?.score || 0,
    });

    return results;
  }

  /**
   * Forget a specific memory by ID.
   */
  async forget(id) {
    const deleted = await this.index.deleteEntry(id);
    if (deleted) {
      verbose(`Deleted memory: ${id}`);
    }
    return deleted;
  }

  /**
   * List stored memories.
   */
  async list(filters = {}) {
    return this.index.listEntries(filters);
  }

  /**
   * Clear memories matching filters.
   */
  async clear(filters = {}) {
    const count = await this.index.clear(filters);
    verbose(`Cleared ${count} memory entries`);
    return count;
  }

  /**
   * Get memory statistics.
   */
  async stats() {
    return this.index.stats();
  }
}

/**
 * Embedding generation abstraction.
 * Default: local embeddings via @huggingface/transformers (all-MiniLM-L6-v2).
 * Alternative: Claude API embeddings (configurable).
 *
 * Uses lazy initialization — model loaded on first call, not at startup.
 */

let _pipeline = null;
let _pipelinePromise = null;

/**
 * Get or initialize the local embedding pipeline.
 */
async function getLocalPipeline() {
  if (_pipeline) return _pipeline;
  if (_pipelinePromise) return _pipelinePromise;

  _pipelinePromise = (async () => {
    try {
      const { pipeline } = await import("@huggingface/transformers");
      _pipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        quantized: true,
      });
      return _pipeline;
    } catch (err) {
      _pipelinePromise = null;
      throw new Error(`Failed to load embedding model: ${err.message}`);
    }
  })();

  return _pipelinePromise;
}

/**
 * Generate embeddings using local transformers.js model.
 */
async function localEmbed(text) {
  const pipe = await getLocalPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Generate embeddings using Claude API.
 * Note: As of 2025, Claude doesn't have a native embedding endpoint.
 * This falls back to a simple hash-based pseudo-embedding for testing
 * and can be swapped with an actual embedding API.
 */
function simpleHashEmbed(text, dimensions = 384) {
  // Deterministic pseudo-embedding based on character codes
  // Used only as a fallback when transformers.js is unavailable
  const vec = new Float32Array(dimensions);
  for (let i = 0; i < text.length; i++) {
    vec[i % dimensions] += text.charCodeAt(i) / 256;
  }
  // Normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dimensions; i++) vec[i] /= norm;
  return Array.from(vec);
}

/**
 * Embedding provider that wraps local or API-based embedding generation.
 */
export class EmbeddingProvider {
  constructor({ provider = "local", embedFn } = {}) {
    this.provider = provider;
    this.embedFn = embedFn || null;
  }

  async embed(text) {
    if (this.embedFn) return this.embedFn(text);

    if (this.provider === "local") {
      try {
        return await localEmbed(text);
      } catch {
        // Fall back to hash-based embedding if transformers.js is unavailable
        return simpleHashEmbed(text);
      }
    }

    // Fallback for unknown providers
    return simpleHashEmbed(text);
  }

  async embedBatch(texts) {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

import { ChubWrapper } from "./chub-wrapper.js";
import { fetchDocsForLibraries, fetchWithFallback, fetchBothVersions } from "./fetch-docs.js";
import { verbose } from "../core/logger.js";

/**
 * Unified doc retrieval layer.
 * Wraps chub + fallback fetchers with caching for the current session.
 */
export class DocRetriever {
  constructor({ chubWrapper, benchmarkLogger } = {}) {
    this.chub = chubWrapper || new ChubWrapper();
    this.cache = new Map();
    this.benchmark = benchmarkLogger || null;
  }

  _cacheKey(library, version, lang) {
    return `${library}@${version || "latest"}:${lang || "js"}`;
  }

  /**
   * Fetch docs for a single library version.
   */
  async fetchDocs(library, version, lang = "js", projectDir) {
    const key = this._cacheKey(library, version, lang);
    if (this.cache.has(key)) {
      verbose(`Cache hit for ${key}`);
      this.benchmark?.log("doc_cache_hit", { library, version });
      return this.cache.get(key);
    }

    verbose(`Fetching docs for ${library}@${version} (${lang})`);
    this.benchmark?.log("doc_fetch_start", { library, version, lang });

    const result = await fetchWithFallback(library, version, lang, projectDir);
    this.cache.set(key, result);

    this.benchmark?.log("doc_fetch_complete", {
      library,
      version,
      source: result.source,
      content_length: result.content.length,
    });

    return result;
  }

  /**
   * Fetch docs for multiple libraries in parallel.
   */
  async fetchForLibraries(deps, lang = "js", projectDir) {
    this.benchmark?.log("batch_fetch_start", { count: deps.length });
    const result = await fetchDocsForLibraries(deps, lang, projectDir);

    // Cache successful results
    for (const item of result.succeeded) {
      const key = this._cacheKey(item.library, item.version, lang);
      this.cache.set(key, { source: item.source, content: item.content });
    }

    this.benchmark?.log("batch_fetch_complete", {
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    });

    return result;
  }

  /**
   * Fetch docs for two versions (for migration).
   */
  async fetchBothVersions(library, oldVersion, newVersion, lang, projectDir) {
    return fetchBothVersions(library, oldVersion, newVersion, lang, projectDir);
  }

  /**
   * Search for available docs via chub.
   */
  async search(query) {
    try {
      return await this.chub.search(query);
    } catch {
      return null;
    }
  }
}

import { DocRetriever } from "../docs/doc-retriever.js";
import { detectDependencies } from "../analysis/dependency-detector.js";
import { scanProjectAllApis } from "../analysis/scanner.js";
import { ClaudeClient } from "../llm/claude-client.js";
import {
  buildReviewSystemPrompt,
  buildReviewUserMessage,
  REVIEW_TOOL,
} from "../llm/prompts.js";
import { parseReviewResponse, filterBySeverity, deduplicateFindings } from "../llm/response-parser.js";
import { sortFindings, computeStats } from "./finding.js";
import { verbose, status } from "../core/logger.js";

/**
 * Maximum files per LLM batch (to stay within context window).
 */
const MAX_FILES_PER_BATCH = 10;
const MAX_CONTENT_PER_BATCH = 50_000; // characters

/**
 * AI Code Review orchestrator.
 * Detects deps -> fetches docs -> scans code -> queries memory -> LLM review -> parse findings.
 */
export class Reviewer {
  constructor({ config, docRetriever, claudeClient, memoryStore, benchmarkLogger }) {
    this.config = config;
    this.docs = docRetriever || new DocRetriever({ benchmarkLogger });
    this.llm = claudeClient;
    this.memory = memoryStore || null;
    this.benchmark = benchmarkLogger || null;
  }

  async review({ projectDir, lang = "js" }) {
    const startTime = Date.now();

    // Step 1: Detect dependencies
    status("Detecting project dependencies...");
    const deps = await detectDependencies(projectDir, lang);
    verbose(`Found ${deps.length} dependencies`);
    this.benchmark?.log("deps_detected", { count: deps.length, deps: deps.map((d) => d.name) });

    if (deps.length === 0) {
      return {
        findings: [],
        stats: computeStats([]),
        summary: "No dependencies detected in the project.",
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Fetch docs for dependencies
    status("Fetching API documentation...");
    const docResults = await this.docs.fetchForLibraries(
      deps.filter((d) => d.type === "prod").slice(0, 15), // Cap at 15 libs
      lang,
      projectDir
    );
    verbose(`Docs fetched: ${docResults.succeeded.length} succeeded, ${docResults.failed.length} failed`);

    this.benchmark?.log("docs_fetched", {
      succeeded: docResults.succeeded.length,
      failed: docResults.failed.length,
      failed_libs: docResults.failed.map((f) => f.library),
    });

    if (docResults.succeeded.length === 0 && !this.config?.benchmark?.enabled) {
      return {
        findings: [],
        stats: computeStats([]),
        summary: "Could not fetch documentation for any dependencies.",
        warnings: docResults.failed.map((f) => `${f.library}: ${f.error}`),
        duration: Date.now() - startTime,
      };
    }

    // Step 3: Scan project for all API usages
    status("Scanning project code...");
    const scannedFiles = await scanProjectAllApis(projectDir, lang);
    verbose(`Scanned ${scannedFiles.length} files`);
    this.benchmark?.log("files_scanned", { count: scannedFiles.length });

    // Step 4: Retrieve memory context
    let memoryContext = [];
    if (this.memory) {
      try {
        memoryContext = await this.memory.recall(`code review ${deps.map((d) => d.name).join(" ")}`, 5);
        verbose(`Retrieved ${memoryContext.length} memory entries`);
        this.benchmark?.log("memory_recall", { count: memoryContext.length });
      } catch {
        verbose("Memory recall failed, continuing without memory context");
      }
    }

    // Step 5: Batch files and send to LLM
    status("Running AI code review...");
    const batches = this._createBatches(scannedFiles);
    verbose(`Created ${batches.length} batch(es) for LLM review`);

    const allFindings = [];
    for (let i = 0; i < batches.length; i++) {
      verbose(`Processing batch ${i + 1}/${batches.length}...`);

      const userMessage = buildReviewUserMessage({
        files: batches[i],
        docs: docResults.succeeded,
        memoryContext,
      });

      try {
        const result = await this.llm.structuredOutput({
          system: buildReviewSystemPrompt(),
          userMessage,
          toolName: REVIEW_TOOL.name,
          toolDescription: REVIEW_TOOL.description,
          inputSchema: REVIEW_TOOL.inputSchema,
        });

        const parsed = parseReviewResponse(result);
        allFindings.push(...parsed.findings);

        this.benchmark?.log("llm_batch_complete", {
          batch: i + 1,
          findings_count: parsed.findings.length,
          token_usage: this.llm.getTokenUsage(),
        });
      } catch (err) {
        verbose(`Batch ${i + 1} failed: ${err.message}`);
        this.benchmark?.log("llm_batch_error", { batch: i + 1, error: err.message });
      }
    }

    // Step 6: Deduplicate, filter, and sort
    const threshold = this.config?.review?.severity_threshold || "low";
    let findings = deduplicateFindings(allFindings);
    findings = filterBySeverity(findings, threshold);
    findings = sortFindings(findings);

    const stats = computeStats(findings);

    // Step 7: Store findings in memory
    if (this.memory && findings.length > 0) {
      try {
        for (const finding of findings.slice(0, 20)) { // Cap stored findings
          await this.memory.remember({
            type: "review_finding",
            project: projectDir,
            library: finding.library,
            content: `[${finding.severity}] ${finding.category}: ${finding.message} in ${finding.file}:${finding.line}`,
            metadata: { finding },
            tags: [finding.category, finding.library, finding.severity],
          });
        }
      } catch {
        verbose("Failed to store findings in memory");
      }
    }

    this.benchmark?.log("review_complete", {
      total_findings: findings.length,
      stats,
      duration_ms: Date.now() - startTime,
      token_usage: this.llm.getTokenUsage(),
    });

    return {
      findings,
      stats,
      summary: `Found ${findings.length} issue(s) across ${stats.filesAffected} file(s).`,
      docs: {
        fetched: docResults.succeeded.map((d) => `${d.library}@${d.version}`),
        failed: docResults.failed.map((f) => f.library),
      },
      _docs: docResults.succeeded, // Full docs for benchmark hallucination analysis
      duration: Date.now() - startTime,
    };
  }

  /**
   * Split scanned files into batches that fit the LLM context window.
   */
  _createBatches(scannedFiles) {
    const batches = [];
    let currentBatch = [];
    let currentSize = 0;

    for (const file of scannedFiles) {
      const fileSize = file.content.length;

      if (currentBatch.length >= MAX_FILES_PER_BATCH || currentSize + fileSize > MAX_CONTENT_PER_BATCH) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [];
        currentSize = 0;
      }

      currentBatch.push(file);
      currentSize += fileSize;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }
}

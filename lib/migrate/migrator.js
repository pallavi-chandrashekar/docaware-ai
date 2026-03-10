import { DocRetriever } from "../docs/doc-retriever.js";
import { diffDocs } from "../analysis/diff-engine.js";
import { scanProject } from "../analysis/scanner.js";
import { ClaudeClient } from "../llm/claude-client.js";
import {
  buildMigrationSystemPrompt,
  buildMigrationUserMessage,
  MIGRATION_TOOL,
} from "../llm/prompts.js";
import { parseMigrationResponse } from "../llm/response-parser.js";
import { verbose, status } from "../core/logger.js";

/**
 * Migration helper orchestrator.
 * Extends the original migrate-helper with LLM-powered plan generation and memory.
 */
export class Migrator {
  constructor({ config, docRetriever, claudeClient, memoryStore, benchmarkLogger }) {
    this.config = config;
    this.docs = docRetriever || new DocRetriever({ benchmarkLogger });
    this.llm = claudeClient || null;
    this.memory = memoryStore || null;
    this.benchmark = benchmarkLogger || null;
  }

  async migrate({ library, oldVersion, newVersion, projectDir, lang = "js", noLlm = false }) {
    const startTime = Date.now();

    // Step 1: Fetch docs for both versions
    status(`Fetching docs for ${library} v${oldVersion} and v${newVersion}...`);
    const { oldDocs, newDocs, sources, warnings } = await this.docs.fetchBothVersions(
      library, oldVersion, newVersion, lang, projectDir
    );

    this.benchmark?.log("migration_docs_fetched", {
      library,
      oldVersion,
      newVersion,
      sources,
    });

    // Step 2: Diff the docs
    status("Comparing documentation...");
    const changes = diffDocs(oldDocs, newDocs);

    this.benchmark?.log("migration_diff_complete", {
      removed: changes.removed.length,
      changed: changes.changed.length,
      added: changes.added.length,
      keywords: changes.keywords.length,
    });

    // Step 3: Collect APIs to scan for
    const apisToScan = [
      ...changes.removed.flatMap((r) =>
        r.apiNames.map((apiName) => ({ apiName, changeType: "removed" }))
      ),
      ...changes.changed.flatMap((ch) =>
        ch.apiNames.map((apiName) => ({ apiName, changeType: "changed" }))
      ),
    ];

    // Step 4: Scan project
    let scanResults = [];
    if (apisToScan.length > 0) {
      status(`Scanning project for ${apisToScan.length} affected API(s)...`);
      scanResults = await scanProject(projectDir, apisToScan, lang);
    }

    this.benchmark?.log("migration_scan_complete", {
      apis_scanned: apisToScan.length,
      matches_found: scanResults.length,
    });

    // Step 5 (optional): LLM-powered migration plan
    let migrationPlan = null;
    if (!noLlm && this.llm) {
      status("Generating AI-powered migration plan...");

      // Retrieve memory context
      let memoryContext = [];
      if (this.memory) {
        try {
          memoryContext = await this.memory.recall(
            `migration ${library} ${oldVersion} ${newVersion}`, 5
          );
          this.benchmark?.log("memory_recall", { count: memoryContext.length });
        } catch {
          verbose("Memory recall failed, continuing without context");
        }
      }

      try {
        const userMessage = buildMigrationUserMessage({
          library,
          oldVersion,
          newVersion,
          changes,
          scanResults,
          memoryContext,
        });

        const result = await this.llm.structuredOutput({
          system: buildMigrationSystemPrompt(),
          userMessage,
          toolName: MIGRATION_TOOL.name,
          toolDescription: MIGRATION_TOOL.description,
          inputSchema: MIGRATION_TOOL.inputSchema,
        });

        migrationPlan = parseMigrationResponse(result);

        this.benchmark?.log("migration_plan_generated", {
          steps: migrationPlan.steps.length,
          effort: migrationPlan.estimatedEffort,
        });
      } catch (err) {
        verbose(`LLM migration plan failed: ${err.message}`);
        this.benchmark?.log("migration_plan_error", { error: err.message });
      }

      // Store migration in memory
      if (this.memory && migrationPlan) {
        try {
          await this.memory.remember({
            type: "migration_decision",
            project: projectDir,
            library,
            content: `Migration ${library} ${oldVersion}->${newVersion}: ${migrationPlan.summary}`,
            metadata: {
              library,
              from: oldVersion,
              to: newVersion,
              steps: migrationPlan.steps.length,
              effort: migrationPlan.estimatedEffort,
            },
            tags: ["migration", library],
          });
        } catch {
          verbose("Failed to store migration in memory");
        }
      }
    }

    return {
      library,
      oldVersion,
      newVersion,
      changes,
      scanResults,
      sources,
      warnings: warnings || [],
      migrationPlan,
      duration: Date.now() - startTime,
    };
  }
}

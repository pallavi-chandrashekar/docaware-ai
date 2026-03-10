/**
 * Prompt templates for LLM analysis.
 * Each function builds a structured prompt for a specific task.
 */

/**
 * Build the system prompt for code review.
 */
export function buildReviewSystemPrompt() {
  return `You are an expert code reviewer specializing in API correctness and best practices.
Your job is to review source code against official API documentation to find:
- Deprecated API usage
- Incorrect API usage (wrong parameters, wrong return type handling)
- Anti-patterns and common mistakes
- Security issues related to API misuse
- Performance anti-patterns

You must base your findings ONLY on the provided documentation. If the documentation does not cover a particular API, do not flag it.
For each finding, provide the exact file path, line number, a clear explanation, and a suggested fix.
Rate your confidence for each finding from 0 to 1.`;
}

/**
 * Build the user message for code review.
 */
export function buildReviewUserMessage({ files, docs, memoryContext }) {
  const parts = [];

  parts.push("## API Documentation\n");
  for (const doc of docs) {
    parts.push(`### ${doc.library} v${doc.version} (source: ${doc.source})\n`);
    parts.push(doc.content.slice(0, 8000)); // Truncate large docs
    parts.push("\n---\n");
  }

  if (memoryContext && memoryContext.length > 0) {
    parts.push("## Relevant Past Findings\n");
    for (const entry of memoryContext) {
      parts.push(`- ${entry.content}\n`);
    }
    parts.push("\n---\n");
  }

  parts.push("## Source Code to Review\n");
  for (const file of files) {
    parts.push(`### File: ${file.file}\n`);
    parts.push("```\n");
    // Include line numbers for reference
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      parts.push(`${i + 1}: ${lines[i]}\n`);
    }
    parts.push("```\n\n");
  }

  parts.push("Review the source code against the API documentation. Report all findings.");

  return parts.join("");
}

/**
 * Tool schema for structured review output.
 */
export const REVIEW_TOOL = {
  name: "report_findings",
  description: "Report code review findings with structured data",
  inputSchema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            file: { type: "string", description: "File path" },
            line: { type: "integer", description: "Line number" },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            category: {
              type: "string",
              enum: ["deprecated_api", "anti_pattern", "incorrect_usage", "security", "performance"],
            },
            library: { type: "string", description: "Related library name" },
            apiName: { type: "string", description: "The specific API identifier" },
            message: { type: "string", description: "Human-readable explanation" },
            suggestion: { type: "string", description: "Suggested fix" },
            docReference: { type: "string", description: "Relevant excerpt from docs" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["file", "line", "severity", "category", "message", "confidence"],
        },
      },
      summary: {
        type: "string",
        description: "Brief overall summary of the review",
      },
    },
    required: ["findings", "summary"],
  },
};

/**
 * Build the system prompt for migration planning.
 */
export function buildMigrationSystemPrompt() {
  return `You are an expert in API migrations and library upgrades.
Given documentation diffs between two versions of a library and the affected code locations,
generate a detailed migration plan with:
- Ordered steps to perform the migration
- Specific code changes needed for each affected file
- Risk assessment for each change
- Overall effort estimation

Base your recommendations ONLY on the provided documentation and code.
Be precise about which API calls need to change and how.`;
}

/**
 * Build the user message for migration planning.
 */
export function buildMigrationUserMessage({ library, oldVersion, newVersion, changes, scanResults, memoryContext }) {
  const parts = [];

  parts.push(`## Migration: ${library} v${oldVersion} -> v${newVersion}\n\n`);

  if (changes.removed.length > 0) {
    parts.push("### Removed APIs\n");
    for (const r of changes.removed) {
      parts.push(`- **${r.heading}**: ${r.apiNames.join(", ")}\n`);
    }
  }

  if (changes.changed.length > 0) {
    parts.push("### Changed APIs\n");
    for (const ch of changes.changed) {
      parts.push(`- **${ch.heading}**: ${ch.apiNames.join(", ")}\n`);
      if (ch.signatureChanges?.length > 0) {
        for (const sig of ch.signatureChanges) {
          parts.push(`  - ${sig.type}: ${sig.old || sig.name} -> ${sig.new || "(changed)"}\n`);
        }
      }
    }
  }

  if (changes.added.length > 0) {
    parts.push("### New APIs Available\n");
    for (const a of changes.added) {
      parts.push(`- **${a.heading}**: ${a.apiNames.join(", ")}\n`);
    }
  }

  if (scanResults && scanResults.length > 0) {
    parts.push("\n### Affected Code Locations\n");
    for (const r of scanResults) {
      parts.push(`- ${r.file}:${r.line} — \`${r.apiName}\` (${r.changeType}, ${r.matchType})\n`);
      parts.push(`  \`${r.content}\`\n`);
    }
  }

  if (memoryContext && memoryContext.length > 0) {
    parts.push("\n### Past Migration Decisions\n");
    for (const entry of memoryContext) {
      parts.push(`- ${entry.content}\n`);
    }
  }

  parts.push("\nGenerate a detailed migration plan with ordered steps and code changes.");

  return parts.join("");
}

/**
 * Tool schema for structured migration plan output.
 */
export const MIGRATION_TOOL = {
  name: "report_migration_plan",
  description: "Report a structured migration plan",
  inputSchema: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            order: { type: "integer" },
            description: { type: "string" },
            affectedFiles: {
              type: "array",
              items: { type: "string" },
            },
            oldCode: { type: "string", description: "Example of old code pattern" },
            newCode: { type: "string", description: "Example of new code pattern" },
            risk: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["order", "description", "risk"],
        },
      },
      estimatedEffort: {
        type: "string",
        enum: ["trivial", "small", "medium", "large"],
      },
      risks: {
        type: "array",
        items: { type: "string" },
      },
      summary: { type: "string" },
    },
    required: ["steps", "estimatedEffort", "summary"],
  },
};

/**
 * Build prompt for memory-enhanced query synthesis.
 */
export function buildMemoryQueryPrompt(query, entries) {
  const parts = [];
  parts.push("Based on these stored memory entries, answer the following query.\n\n");
  parts.push(`Query: ${query}\n\n`);
  parts.push("Memory entries:\n");
  for (const entry of entries) {
    parts.push(`- [${entry.type}] ${entry.content}\n`);
    if (entry.metadata) {
      parts.push(`  metadata: ${JSON.stringify(entry.metadata)}\n`);
    }
  }
  parts.push("\nSynthesize a concise, actionable answer.");
  return parts.join("");
}

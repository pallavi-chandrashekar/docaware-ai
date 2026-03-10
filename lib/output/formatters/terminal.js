import { c } from "../../core/logger.js";

const SEVERITY_ICONS = {
  critical: c.red("[CRITICAL]"),
  high: c.red("[HIGH]"),
  medium: c.yellow("[MEDIUM]"),
  low: c.dim("[LOW]"),
};

const CATEGORY_LABELS = {
  deprecated_api: "Deprecated API",
  anti_pattern: "Anti-pattern",
  incorrect_usage: "Incorrect Usage",
  security: "Security",
  performance: "Performance",
};

/**
 * Format review findings as colored terminal output.
 */
export function formatReviewTerminal(result) {
  const lines = [];
  const hr = "\u2500".repeat(60);

  lines.push("");
  lines.push(c.bold(hr));
  lines.push(c.bold("  DocAware AI Code Review"));
  lines.push(c.bold(hr));
  lines.push("");

  // Docs info
  if (result.docs) {
    if (result.docs.fetched.length > 0) {
      lines.push(c.dim(`  Docs fetched: ${result.docs.fetched.join(", ")}`));
    }
    if (result.docs.failed.length > 0) {
      lines.push(c.yellow(`  Docs unavailable: ${result.docs.failed.join(", ")}`));
    }
    lines.push("");
  }

  // Findings
  if (result.findings.length === 0) {
    lines.push(c.green("  No issues found. Code looks good!"));
    lines.push("");
  } else {
    lines.push(c.bold("  FINDINGS"));
    lines.push("");

    for (const finding of result.findings) {
      const icon = SEVERITY_ICONS[finding.severity] || c.dim("[?]");
      const category = CATEGORY_LABELS[finding.category] || finding.category;

      lines.push(`  ${icon} ${c.cyan(category)}`);
      lines.push(`    ${finding.file}:${finding.line}`);
      lines.push(`    ${finding.message}`);

      if (finding.apiName) {
        lines.push(`    API: ${c.bold(finding.apiName)}${finding.library ? ` (${finding.library})` : ""}`);
      }

      if (finding.suggestion) {
        lines.push(`    ${c.green("Fix:")} ${finding.suggestion}`);
      }

      if (finding.docReference) {
        lines.push(`    ${c.dim(`Docs: ${finding.docReference}`)}`);
      }

      lines.push(`    ${c.dim(`Confidence: ${(finding.confidence * 100).toFixed(0)}%`)}`);
      lines.push("");
    }
  }

  // Stats
  lines.push(c.bold("  SUMMARY"));
  lines.push("");
  const s = result.stats;
  lines.push(`  ${s.total} issue(s) found across ${s.filesAffected} file(s)`);

  if (s.total > 0) {
    const parts = [];
    if (s.bySeverity.critical) parts.push(c.red(`${s.bySeverity.critical} critical`));
    if (s.bySeverity.high) parts.push(c.red(`${s.bySeverity.high} high`));
    if (s.bySeverity.medium) parts.push(c.yellow(`${s.bySeverity.medium} medium`));
    if (s.bySeverity.low) parts.push(c.dim(`${s.bySeverity.low} low`));
    lines.push(`  Severity: ${parts.join(", ")}`);
    lines.push(`  Avg confidence: ${(s.avgConfidence * 100).toFixed(0)}%`);
  }

  lines.push(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format migration report as colored terminal output.
 */
export function formatMigrationTerminal(result) {
  const lines = [];
  const hr = "\u2500".repeat(60);

  lines.push("");
  lines.push(c.bold(hr));
  lines.push(c.bold(`  Migration Report: ${result.library} v${result.oldVersion} \u2192 v${result.newVersion}`));
  lines.push(c.bold(hr));

  if (result.sources) {
    lines.push("");
    lines.push(c.dim(`  Data sources: old=${result.sources.old}, new=${result.sources.new}`));
    for (const w of result.warnings) {
      lines.push(c.dim(`  \u26A0 ${w}`));
    }
  }
  lines.push("");

  const { changes } = result;

  // Breaking changes
  if (changes.removed.length > 0 || changes.changed.length > 0 || changes.keywords.length > 0) {
    lines.push(c.bold("  BREAKING CHANGES"));
    lines.push("");

    for (const item of changes.removed) {
      const apis = item.apiNames.length > 0 ? item.apiNames.join(", ") : "(section)";
      lines.push(`  ${c.red("[REMOVED]")} ${c.cyan(apis)}`);
      lines.push(`           ${c.dim(`Section: "${item.heading}"`)}`);
      if (item.signatures?.length > 0) {
        for (const sig of item.signatures) {
          const params = sig.params ? `(${sig.params.join(", ")})` : "";
          lines.push(`           ${c.dim(`${sig.type}: ${sig.name}${params}`)}`);
        }
      }
    }

    for (const item of changes.changed) {
      const apis = item.apiNames.length > 0 ? item.apiNames.join(", ") : "(section)";
      lines.push(`  ${c.yellow("[CHANGED]")} ${c.cyan(apis)}`);
      if (item.headingRenamed) {
        lines.push(`           ${c.magenta(`Section renamed: "${item.headingRenamed.from}" \u2192 "${item.headingRenamed.to}"`)}`);
      } else {
        lines.push(`           ${c.dim(`Section: "${item.heading}"`)}`);
      }
      if (item.signatureChanges?.length > 0) {
        for (const sig of item.signatureChanges) {
          switch (sig.type) {
            case "renamed":
              lines.push(`           ${c.magenta("RENAMED:")} ${sig.old} \u2192 ${sig.new}`);
              break;
            case "params_changed":
              lines.push(`           ${c.yellow("PARAMS:")} ${sig.name}(${(sig.oldParams || []).join(", ")}) \u2192 (${(sig.newParams || []).join(", ")})`);
              break;
            case "signature_removed":
              lines.push(`           ${c.red("SIG REMOVED:")} ${sig.name}(${(sig.params || []).join(", ")})`);
              break;
            case "signature_added":
              lines.push(`           ${c.green("SIG ADDED:")} ${sig.name}(${(sig.params || []).join(", ")})`);
              break;
          }
        }
      }
    }

    for (const kw of changes.keywords) {
      lines.push(`  ${c.red("[KEYWORD]")} "${kw.term}" found in "${kw.heading}"`);
      lines.push(`           ${c.dim(kw.context)}`);
    }
    lines.push("");
  } else {
    lines.push(c.green("  No breaking changes detected in documentation."));
    lines.push("");
  }

  // New APIs
  if (changes.added.length > 0) {
    lines.push(c.bold("  NEW APIs"));
    lines.push("");
    for (const item of changes.added) {
      const apis = item.apiNames.length > 0 ? item.apiNames.join(", ") : "(section)";
      lines.push(`  ${c.green("[ADDED]")} ${c.cyan(apis)}`);
      lines.push(`         ${c.dim(`Section: "${item.heading}"`)}`);
    }
    lines.push("");
  }

  // Affected files
  if (result.scanResults && result.scanResults.length > 0) {
    lines.push(c.bold("  AFFECTED FILES IN YOUR PROJECT"));
    lines.push("");

    const astMatches = result.scanResults.filter((r) => r.matchType === "ast");
    const stringMatches = result.scanResults.filter((r) => r.matchType === "string");

    for (const r of astMatches) {
      const tag = r.changeType === "removed" ? c.red("[REMOVED]") : c.yellow("[CHANGED]");
      lines.push(`  ${r.file}:${r.line}  ${tag} ${c.cyan(r.apiName)} ${c.dim(`(${r.identType})`)}`);
      lines.push(`    ${c.dim(r.content)}`);
    }

    if (stringMatches.length > 0 && astMatches.length > 0) {
      lines.push("");
      lines.push(c.dim("  Possible matches (string-based, verify manually):"));
    }
    for (const r of stringMatches) {
      const tag = r.changeType === "removed" ? c.red("[REMOVED]") : c.yellow("[CHANGED]");
      lines.push(`  ${r.file}:${r.line}  ${tag} ${c.cyan(r.apiName)} ${c.dim("(string match)")}`);
      lines.push(`    ${c.dim(r.content)}`);
    }
    lines.push("");
  }

  // LLM Migration Plan
  if (result.migrationPlan) {
    const plan = result.migrationPlan;
    lines.push(c.bold("  AI MIGRATION PLAN"));
    lines.push("");
    lines.push(`  Estimated effort: ${c.cyan(plan.estimatedEffort)}`);
    lines.push("");

    for (const step of plan.steps) {
      const riskColor = step.risk === "high" ? c.red : step.risk === "medium" ? c.yellow : c.green;
      lines.push(`  ${c.bold(`Step ${step.order}:`)} ${step.description}`);
      lines.push(`    Risk: ${riskColor(step.risk)}`);

      if (step.affectedFiles?.length > 0) {
        lines.push(`    Files: ${step.affectedFiles.join(", ")}`);
      }
      if (step.oldCode) {
        lines.push(`    ${c.red("- " + step.oldCode)}`);
      }
      if (step.newCode) {
        lines.push(`    ${c.green("+ " + step.newCode)}`);
      }
      lines.push("");
    }

    if (plan.risks?.length > 0) {
      lines.push(`  ${c.yellow("Risks:")}`);
      for (const risk of plan.risks) {
        lines.push(`    - ${risk}`);
      }
      lines.push("");
    }
  }

  // Summary
  const breakingCount = changes.removed.length + changes.changed.length;
  const fileCount = result.scanResults ? new Set(result.scanResults.map((r) => r.file)).size : 0;

  lines.push(c.bold("  SUMMARY"));
  lines.push("");
  lines.push(`  ${breakingCount} breaking change(s) detected`);
  lines.push(`  ${changes.added.length} new API(s) available`);
  if (result.scanResults) {
    lines.push(`  ${fileCount} file(s) affected (${result.scanResults.length} occurrence(s))`);
  }
  lines.push(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format memory stats as terminal output.
 */
export function formatMemoryStatsTerminal(stats) {
  const lines = [];
  lines.push("");
  lines.push(c.bold("  Memory Statistics"));
  lines.push("");
  lines.push(`  Total entries: ${stats.totalEntries}`);
  lines.push(`  Storage: ${stats.storageDir}`);
  if (Object.keys(stats.byType).length > 0) {
    lines.push("");
    lines.push("  By type:");
    for (const [type, count] of Object.entries(stats.byType)) {
      lines.push(`    ${type}: ${count}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

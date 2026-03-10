/**
 * Markdown output formatters for saving reports to files.
 */

export function formatReviewMarkdown(result) {
  const lines = [];

  lines.push("# DocAware AI Code Review Report\n");
  lines.push(`**Date:** ${new Date().toISOString()}\n`);

  if (result.docs) {
    lines.push("## Documentation Sources\n");
    if (result.docs.fetched.length > 0) {
      lines.push(`Fetched: ${result.docs.fetched.join(", ")}\n`);
    }
    if (result.docs.failed.length > 0) {
      lines.push(`> Unavailable: ${result.docs.failed.join(", ")}\n`);
    }
  }

  lines.push("## Findings\n");

  if (result.findings.length === 0) {
    lines.push("No issues found.\n");
  } else {
    lines.push(`| Severity | Category | File | Line | Message |`);
    lines.push(`|----------|----------|------|------|---------|`);

    for (const f of result.findings) {
      const msg = f.message.replace(/\|/g, "\\|");
      lines.push(`| ${f.severity} | ${f.category} | \`${f.file}\` | ${f.line} | ${msg} |`);
    }
    lines.push("");

    // Detailed findings
    lines.push("### Details\n");
    for (const f of result.findings) {
      lines.push(`#### ${f.severity.toUpperCase()}: ${f.message}\n`);
      lines.push(`- **File:** \`${f.file}:${f.line}\``);
      lines.push(`- **Category:** ${f.category}`);
      if (f.apiName) lines.push(`- **API:** \`${f.apiName}\` (${f.library || "unknown"})`);
      if (f.suggestion) lines.push(`- **Fix:** ${f.suggestion}`);
      if (f.docReference) lines.push(`- **Docs:** ${f.docReference}`);
      lines.push(`- **Confidence:** ${(f.confidence * 100).toFixed(0)}%`);
      lines.push("");
    }
  }

  lines.push("## Summary\n");
  const s = result.stats;
  lines.push(`- **Total issues:** ${s.total}`);
  lines.push(`- **Files affected:** ${s.filesAffected}`);
  lines.push(`- **Duration:** ${(result.duration / 1000).toFixed(1)}s`);
  lines.push("");

  return lines.join("\n");
}

export function formatMigrationMarkdown(result) {
  const lines = [];

  lines.push(`# Migration Report: ${result.library} v${result.oldVersion} → v${result.newVersion}\n`);
  lines.push(`**Date:** ${new Date().toISOString()}\n`);

  const { changes } = result;

  if (changes.removed.length > 0) {
    lines.push("## Removed APIs\n");
    for (const r of changes.removed) {
      lines.push(`- **${r.heading}:** ${r.apiNames.join(", ")}`);
    }
    lines.push("");
  }

  if (changes.changed.length > 0) {
    lines.push("## Changed APIs\n");
    for (const ch of changes.changed) {
      lines.push(`- **${ch.heading}:** ${ch.apiNames.join(", ")}`);
      if (ch.signatureChanges?.length > 0) {
        for (const sig of ch.signatureChanges) {
          lines.push(`  - ${sig.type}: \`${sig.old || sig.name}\` → \`${sig.new || "(changed)"}\``);
        }
      }
    }
    lines.push("");
  }

  if (changes.added.length > 0) {
    lines.push("## New APIs\n");
    for (const a of changes.added) {
      lines.push(`- **${a.heading}:** ${a.apiNames.join(", ")}`);
    }
    lines.push("");
  }

  if (result.scanResults?.length > 0) {
    lines.push("## Affected Files\n");
    lines.push("| File | Line | API | Change | Match |");
    lines.push("|------|------|-----|--------|-------|");
    for (const r of result.scanResults) {
      lines.push(`| \`${r.file}\` | ${r.line} | \`${r.apiName}\` | ${r.changeType} | ${r.matchType} |`);
    }
    lines.push("");
  }

  if (result.migrationPlan) {
    lines.push("## AI Migration Plan\n");
    lines.push(`**Estimated effort:** ${result.migrationPlan.estimatedEffort}\n`);

    for (const step of result.migrationPlan.steps) {
      lines.push(`### Step ${step.order}: ${step.description}\n`);
      lines.push(`**Risk:** ${step.risk}\n`);
      if (step.oldCode) {
        lines.push("```diff");
        lines.push(`- ${step.oldCode}`);
        lines.push(`+ ${step.newCode || ""}`);
        lines.push("```\n");
      }
    }

    if (result.migrationPlan.risks?.length > 0) {
      lines.push("### Risks\n");
      for (const risk of result.migrationPlan.risks) {
        lines.push(`- ${risk}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

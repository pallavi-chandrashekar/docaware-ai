/**
 * Finding data model and utilities.
 */

export const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * Sort findings by severity (critical first), then by file and line.
 */
export function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    const fileDiff = a.file.localeCompare(b.file);
    if (fileDiff !== 0) return fileDiff;
    return a.line - b.line;
  });
}

/**
 * Group findings by file.
 */
export function groupByFile(findings) {
  const groups = new Map();
  for (const finding of findings) {
    if (!groups.has(finding.file)) {
      groups.set(finding.file, []);
    }
    groups.get(finding.file).push(finding);
  }
  return groups;
}

/**
 * Group findings by category.
 */
export function groupByCategory(findings) {
  const groups = new Map();
  for (const finding of findings) {
    if (!groups.has(finding.category)) {
      groups.set(finding.category, []);
    }
    groups.get(finding.category).push(finding);
  }
  return groups;
}

/**
 * Compute review statistics.
 */
export function computeStats(findings) {
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  const byCategory = {};
  const files = new Set();

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    files.add(f.file);
  }

  return {
    total: findings.length,
    bySeverity,
    byCategory,
    filesAffected: files.size,
    avgConfidence: findings.length > 0
      ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
      : 0,
  };
}

import { createHash } from "node:crypto";

/**
 * Parse and validate structured LLM responses.
 */

const SEVERITY_LEVELS = ["low", "medium", "high", "critical"];
const CATEGORIES = ["deprecated_api", "anti_pattern", "incorrect_usage", "security", "performance"];

/**
 * Generate a unique ID for a finding based on file, line, and category.
 */
function findingId(finding) {
  const input = `${finding.file}:${finding.line}:${finding.category}:${finding.apiName || ""}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

/**
 * Validate and normalize a single finding.
 */
function normalizeFinding(raw) {
  const finding = {
    file: raw.file || "unknown",
    line: typeof raw.line === "number" ? raw.line : 0,
    severity: SEVERITY_LEVELS.includes(raw.severity) ? raw.severity : "medium",
    category: CATEGORIES.includes(raw.category) ? raw.category : "incorrect_usage",
    library: raw.library || "",
    apiName: raw.apiName || "",
    message: raw.message || "No description provided",
    suggestion: raw.suggestion || "",
    docReference: raw.docReference || "",
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
  };

  finding.id = findingId(finding);
  return finding;
}

/**
 * Parse review findings from Claude tool_use response.
 */
export function parseReviewResponse(toolInput) {
  if (!toolInput || !Array.isArray(toolInput.findings)) {
    return { findings: [], summary: "No findings returned" };
  }

  const findings = toolInput.findings.map(normalizeFinding);
  const summary = toolInput.summary || `${findings.length} finding(s) detected`;

  return { findings, summary };
}

/**
 * Parse migration plan from Claude tool_use response.
 */
export function parseMigrationResponse(toolInput) {
  if (!toolInput || !Array.isArray(toolInput.steps)) {
    return {
      steps: [],
      estimatedEffort: "unknown",
      risks: [],
      summary: "No migration plan generated",
    };
  }

  const steps = toolInput.steps.map((step, i) => ({
    order: step.order || i + 1,
    description: step.description || "",
    affectedFiles: Array.isArray(step.affectedFiles) ? step.affectedFiles : [],
    oldCode: step.oldCode || "",
    newCode: step.newCode || "",
    risk: ["low", "medium", "high"].includes(step.risk) ? step.risk : "medium",
  }));

  return {
    steps,
    estimatedEffort: toolInput.estimatedEffort || "medium",
    risks: Array.isArray(toolInput.risks) ? toolInput.risks : [],
    summary: toolInput.summary || `${steps.length} migration step(s) planned`,
  };
}

/**
 * Filter findings by severity threshold.
 */
export function filterBySeverity(findings, threshold = "low") {
  const thresholdIdx = SEVERITY_LEVELS.indexOf(threshold);
  return findings.filter((f) => SEVERITY_LEVELS.indexOf(f.severity) >= thresholdIdx);
}

/**
 * Deduplicate findings by ID.
 */
export function deduplicateFindings(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

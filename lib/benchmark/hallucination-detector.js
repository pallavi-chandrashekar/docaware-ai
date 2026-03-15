/**
 * Hallucination detector — cross-references LLM findings against
 * actual documentation to measure grounding accuracy.
 *
 * Key metrics for the paper:
 * - Hallucination rate: % of findings referencing APIs not in docs
 * - Grounding rate: % of findings traceable to doc content
 * - False positive rate: findings flagging correct code as wrong
 * - Precision/recall against known ground truth
 */

import { extractApiNames } from "../analysis/diff-engine.js";

/**
 * Build a set of all API names mentioned in fetched documentation.
 */
export function buildDocApiIndex(docs) {
  const index = new Map(); // apiName -> { library, docExcerpt }

  for (const doc of docs) {
    const apiNames = extractApiNames(doc.content);
    for (const name of apiNames) {
      index.set(name, {
        library: doc.library,
        version: doc.version,
      });
    }

    // Also extract from headings
    const headings = doc.content.matchAll(/^#{1,4}\s+(.+)/gm);
    for (const h of headings) {
      const inlineApis = h[1].matchAll(/`([a-zA-Z_]\w*(?:\.\w+)*)`/g);
      for (const m of inlineApis) {
        index.set(m[1], { library: doc.library, version: doc.version });
      }
    }
  }

  return index;
}

/**
 * Check if a finding's apiName exists in the documentation.
 * Uses fuzzy matching: "client.chat.completions.create" matches
 * if docs mention "chat.completions.create" or "completions.create".
 */
export function isGrounded(finding, docIndex) {
  if (!finding.apiName) return { grounded: false, reason: "no_api_name" };

  // Exact match
  if (docIndex.has(finding.apiName)) {
    return { grounded: true, match: finding.apiName, type: "exact" };
  }

  // Partial match — check if any suffix matches
  const parts = finding.apiName.split(".");
  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(i).join(".");
    if (docIndex.has(suffix)) {
      return { grounded: true, match: suffix, type: "suffix" };
    }
  }

  // Check if the doc index contains any key that ends with the finding's apiName
  for (const [key] of docIndex) {
    if (key.endsWith(`.${finding.apiName}`) || key === finding.apiName) {
      return { grounded: true, match: key, type: "reverse_suffix" };
    }
  }

  return { grounded: false, reason: "not_in_docs" };
}

/**
 * Analyze a complete set of findings against documentation.
 * Returns detailed hallucination metrics.
 */
export function analyzeHallucinations(findings, docs) {
  const docIndex = buildDocApiIndex(docs);

  const results = {
    total_findings: findings.length,
    grounded: 0,
    hallucinated: 0,
    no_api_name: 0,
    grounding_details: [],
    hallucination_rate: 0,
    grounding_rate: 0,
    doc_api_count: docIndex.size,
  };

  for (const finding of findings) {
    const check = isGrounded(finding, docIndex);
    results.grounding_details.push({
      finding_id: finding.id,
      apiName: finding.apiName,
      ...check,
    });

    if (check.grounded) {
      results.grounded++;
    } else if (check.reason === "no_api_name") {
      results.no_api_name++;
    } else {
      results.hallucinated++;
    }
  }

  const denominator = results.total_findings - results.no_api_name;
  results.hallucination_rate = denominator > 0 ? results.hallucinated / denominator : 0;
  results.grounding_rate = denominator > 0 ? results.grounded / denominator : 0;

  return results;
}

/**
 * Compare findings against known ground truth (for benchmark datasets).
 *
 * Ground truth format:
 * [{ file, line, apiName, category, isReal: true/false }]
 *
 * Returns precision, recall, F1.
 */
export function evaluateAgainstGroundTruth(findings, groundTruth) {
  // Normalize file paths (strip absolute prefix, compare basenames)
  const normFile = (f) => f.replace(/.*\/bench\/fixtures\/[^/]+\//, "").replace(/.*\//, "");
  const normApi = (a) => (a || "").split(".").pop(); // Compare last segment

  const realTruth = groundTruth.filter((g) => g.isReal);

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  const matchedTruth = new Set();

  for (const f of findings) {
    const fFile = normFile(f.file);
    const fApi = normApi(f.apiName);

    // Find a matching ground truth entry (fuzzy: same file, nearby line, similar API)
    let matched = false;
    for (let i = 0; i < realTruth.length; i++) {
      if (matchedTruth.has(i)) continue;
      const g = realTruth[i];
      const gFile = normFile(g.file);
      const gApi = normApi(g.apiName);

      const fileMatch = fFile === gFile || f.file.endsWith(g.file);
      const lineMatch = Math.abs(f.line - g.line) <= 3; // Allow 3-line tolerance
      const apiMatch = fApi === gApi || (f.apiName || "").includes(gApi) || (g.apiName || "").includes(fApi);

      if (fileMatch && (lineMatch || apiMatch)) {
        truePositives++;
        matchedTruth.add(i);
        matched = true;
        break;
      }
    }

    if (!matched) {
      falsePositives++;
    }
  }

  falseNegatives = realTruth.length - matchedTruth.size;

  const precision = (truePositives + falsePositives) > 0
    ? truePositives / (truePositives + falsePositives) : 0;
  const recall = (truePositives + falseNegatives) > 0
    ? truePositives / (truePositives + falseNegatives) : 0;
  const f1 = (precision + recall) > 0
    ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    total_ground_truth: groundTruth.length,
    total_findings: findings.length,
  };
}

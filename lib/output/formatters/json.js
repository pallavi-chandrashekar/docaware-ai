/**
 * JSON output formatters.
 */

export function formatReviewJson(result) {
  return JSON.stringify(result, null, 2);
}

export function formatMigrationJson(result) {
  return JSON.stringify(result, null, 2);
}

export function formatMemoryJson(data) {
  return JSON.stringify(data, null, 2);
}

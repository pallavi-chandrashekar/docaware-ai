import { randomUUID } from "node:crypto";

/**
 * Memory entry types and schemas.
 */

export const ENTRY_TYPES = [
  "review_finding",
  "migration_decision",
  "pattern",
  "annotation",
  "custom",
];

/**
 * Create a new memory entry with defaults.
 */
export function createEntry({ type = "custom", project = "", library = "", content, metadata = {}, tags = [] }) {
  if (!content) {
    throw new Error("Memory entry requires content");
  }

  if (!ENTRY_TYPES.includes(type)) {
    throw new Error(`Invalid entry type: ${type}. Must be one of: ${ENTRY_TYPES.join(", ")}`);
  }

  return {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    project,
    library,
    content,
    metadata,
    tags,
  };
}

/**
 * Validate an existing memory entry.
 */
export function validateEntry(entry) {
  const errors = [];
  if (!entry.id) errors.push("Missing id");
  if (!entry.content) errors.push("Missing content");
  if (!ENTRY_TYPES.includes(entry.type)) errors.push(`Invalid type: ${entry.type}`);
  return { valid: errors.length === 0, errors };
}

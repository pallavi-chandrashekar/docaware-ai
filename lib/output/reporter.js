import { formatReviewTerminal, formatMigrationTerminal, formatMemoryStatsTerminal } from "./formatters/terminal.js";
import { formatReviewJson, formatMigrationJson, formatMemoryJson } from "./formatters/json.js";
import { formatReviewMarkdown, formatMigrationMarkdown } from "./formatters/markdown.js";

/**
 * Unified report generator.
 * Delegates to the appropriate formatter based on output format.
 */
export function formatOutput(type, data, format = "terminal") {
  const formatters = {
    review: {
      terminal: formatReviewTerminal,
      json: formatReviewJson,
      markdown: formatReviewMarkdown,
    },
    migration: {
      terminal: formatMigrationTerminal,
      json: formatMigrationJson,
      markdown: formatMigrationMarkdown,
    },
    memory_stats: {
      terminal: formatMemoryStatsTerminal,
      json: formatMemoryJson,
      markdown: formatMemoryJson, // Reuse JSON for markdown
    },
    memory_list: {
      terminal: (data) => {
        if (data.length === 0) return "  No memory entries found.\n";
        return data.map((e) => `  [${e.type}] ${e.content} (${e.timestamp})`).join("\n") + "\n";
      },
      json: formatMemoryJson,
      markdown: formatMemoryJson,
    },
    memory_search: {
      terminal: (data) => {
        if (data.length === 0) return "  No matching memories found.\n";
        return data.map((e) =>
          `  [${(e.score * 100).toFixed(0)}%] [${e.type}] ${e.content}`
        ).join("\n") + "\n";
      },
      json: formatMemoryJson,
      markdown: formatMemoryJson,
    },
  };

  const formatter = formatters[type]?.[format];
  if (!formatter) {
    throw new Error(`Unknown output format: ${type}/${format}`);
  }

  return formatter(data);
}

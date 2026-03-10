import { parseArgs } from "node:util";
import { loadConfig } from "../core/config.js";
import { setVerbose, info, error } from "../core/logger.js";
import { MemoryStore } from "../memory/memory-store.js";
import { AnnotationSync } from "../memory/annotation-sync.js";
import { formatOutput } from "../output/reporter.js";

function printUsage() {
  info(`
Usage: docaware memory <subcommand> [options]

Manage persistent agent memory across sessions.

Subcommands:
  search <query>       Semantic search across memory
  list                 List stored entries
  add <text>           Manually add a memory entry
  clear                Clear entries
  sync                 Sync with chub annotations
  stats                Show index statistics

Options:
  --type <type>        Filter by type: review_finding, migration_decision, pattern, annotation, custom
  --library <name>     Filter by library
  --top <n>            Max results for search (default: 5)
  --tags <t1,t2>       Tags for new entries (comma-separated)
  --before <date>      Clear entries before date (ISO 8601)
  --format <type>      Output: terminal, json (default: terminal)
  --verbose            Verbose logging
  --help               Show this help

Examples:
  docaware memory search "stripe webhook verification"
  docaware memory list --type migration_decision
  docaware memory add "Always use raw body for Stripe webhooks" --library stripe
  docaware memory clear --before 2024-01-01
  docaware memory sync
`);
}

export async function run(argv) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        type: { type: "string" },
        library: { type: "string" },
        top: { type: "string", default: "5" },
        tags: { type: "string" },
        before: { type: "string" },
        format: { type: "string", default: "terminal" },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (e) {
    error(e.message);
    printUsage();
    process.exit(1);
  }

  if (args.values.help || args.positionals.length === 0) {
    printUsage();
    return;
  }

  if (args.values.verbose) setVerbose(true);

  const config = await loadConfig({
    output: { format: args.values.format },
  });

  const memoryStore = new MemoryStore({ config });
  const subcommand = args.positionals[0];
  const format = args.values.format;

  switch (subcommand) {
    case "search": {
      const query = args.positionals.slice(1).join(" ");
      if (!query) {
        error("Search query is required.");
        process.exit(1);
      }

      const filters = {};
      if (args.values.type) filters.type = args.values.type;
      if (args.values.library) filters.library = args.values.library;

      const results = await memoryStore.recall(query, parseInt(args.values.top), filters);
      info(formatOutput("memory_search", results, format));
      break;
    }

    case "list": {
      const filters = {};
      if (args.values.type) filters.type = args.values.type;
      if (args.values.library) filters.library = args.values.library;
      if (args.values.before) filters.before = args.values.before;

      const entries = await memoryStore.list(filters);
      info(formatOutput("memory_list", entries, format));
      break;
    }

    case "add": {
      const text = args.positionals.slice(1).join(" ");
      if (!text) {
        error("Text to remember is required.");
        process.exit(1);
      }

      const tags = args.values.tags ? args.values.tags.split(",").map((t) => t.trim()) : [];

      const entry = await memoryStore.remember({
        type: args.values.type || "custom",
        library: args.values.library || "",
        content: text,
        tags,
      });

      info(`  Stored memory: ${entry.id}`);
      break;
    }

    case "clear": {
      const filters = {};
      if (args.values.type) filters.type = args.values.type;
      if (args.values.before) filters.before = args.values.before;

      const count = await memoryStore.clear(filters);
      info(`  Cleared ${count} memory entries.`);
      break;
    }

    case "sync": {
      const annotationSync = new AnnotationSync({ memoryStore });
      const { imported, exported } = await annotationSync.sync();
      info(`  Synced: ${imported} imported from chub, ${exported} exported to chub.`);
      break;
    }

    case "stats": {
      const stats = await memoryStore.stats();
      info(formatOutput("memory_stats", stats, format));
      break;
    }

    default:
      error(`Unknown memory subcommand: ${subcommand}`);
      printUsage();
      process.exit(1);
  }
}

const useColor = !process.env.NO_COLOR;

export const c = {
  red: (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  magenta: (s) => (useColor ? `\x1b[35m${s}\x1b[0m` : s),
  bold: (s) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  blue: (s) => (useColor ? `\x1b[34m${s}\x1b[0m` : s),
};

let verboseEnabled = false;

export function setVerbose(enabled) {
  verboseEnabled = enabled;
}

export function info(msg) {
  console.log(msg);
}

export function warn(msg) {
  console.log(c.yellow(`  warning: ${msg}`));
}

export function error(msg) {
  console.error(c.red(`  error: ${msg}`));
}

export function verbose(msg) {
  if (verboseEnabled) {
    console.log(c.dim(`  [verbose] ${msg}`));
  }
}

export function success(msg) {
  console.log(c.green(`  ${msg}`));
}

export function status(msg) {
  console.log(c.cyan(`  ${msg}`));
}

/**
 * Benchmark logger — writes structured JSON lines for research evaluation.
 */
export class BenchmarkLogger {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.entries = [];
  }

  log(event, data) {
    if (!this.enabled) return;
    this.entries.push({
      timestamp: new Date().toISOString(),
      event,
      ...data,
    });
  }

  getEntries() {
    return this.entries;
  }

  summary() {
    if (!this.enabled) return null;
    const counts = {};
    for (const entry of this.entries) {
      counts[entry.event] = (counts[entry.event] || 0) + 1;
    }
    return counts;
  }
}

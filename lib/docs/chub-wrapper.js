import { execFile as execFileCb } from "node:child_process";

/**
 * Programmatic wrapper around the chub CLI.
 * Accepts an optional execFn for testability (constructor injection).
 */
export class ChubWrapper {
  constructor({ execFn = execFileCb, timeout = 30_000 } = {}) {
    this.execFn = execFn;
    this.timeout = timeout;
  }

  /**
   * Execute a chub command and return stdout.
   */
  _exec(args) {
    return new Promise((resolve, reject) => {
      this.execFn("chub", args, { timeout: this.timeout }, (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT") {
            reject(new Error("chub is not installed. Run: npm install -g @aisuite/chub"));
            return;
          }
          reject(new Error(`chub ${args.join(" ")} failed: ${stderr || err.message}`));
          return;
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Search for docs/skills matching a query.
   */
  async search(query = "") {
    const args = ["search"];
    if (query) args.push(query);
    const output = await this._exec(args);
    return output.trim();
  }

  /**
   * Fetch documentation by ID with optional version and language.
   */
  async get(id, { version, lang, full = false } = {}) {
    const args = ["get", id];
    if (version) args.push("--version", version);
    if (lang) args.push("--lang", lang);
    if (full) args.push("--full");
    const output = await this._exec(args);
    if (!output.trim()) {
      throw new Error(`No docs returned for ${id}${version ? `@${version}` : ""}`);
    }
    return output;
  }

  /**
   * Attach a local annotation to a doc.
   */
  async annotate(id, note) {
    const args = ["annotate", id, note];
    return this._exec(args);
  }

  /**
   * Clear annotations for a doc.
   */
  async clearAnnotations(id) {
    return this._exec(["annotate", id, "--clear"]);
  }

  /**
   * List all stored annotations.
   */
  async listAnnotations() {
    const output = await this._exec(["annotate", "--list"]);
    return output.trim();
  }

  /**
   * Send feedback (up/down) for a doc.
   */
  async feedback(id, rating) {
    if (rating !== "up" && rating !== "down") {
      throw new Error('Rating must be "up" or "down"');
    }
    return this._exec(["feedback", id, rating]);
  }

  /**
   * Check if chub is available on this system.
   */
  async isAvailable() {
    try {
      await this._exec(["--version"]);
      return true;
    } catch {
      return false;
    }
  }
}

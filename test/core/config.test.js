import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, validateConfig } from "../../lib/core/config.js";

describe("loadConfig", () => {
  it("returns defaults when no config file exists", async () => {
    const config = await loadConfig();
    assert.equal(config.claude.model, "claude-sonnet-4-5-20250929");
    assert.equal(config.claude.max_tokens, 4096);
    assert.equal(config.review.severity_threshold, "low");
    assert.equal(config.memory.enabled, true);
  });

  it("merges CLI overrides", async () => {
    const config = await loadConfig({
      review: { severity_threshold: "high" },
      output: { format: "json" },
    });
    assert.equal(config.review.severity_threshold, "high");
    assert.equal(config.output.format, "json");
    // Defaults should still be present
    assert.equal(config.claude.model, "claude-sonnet-4-5-20250929");
  });

  it("reads API key from environment", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key-123";
    const config = await loadConfig();
    assert.equal(config.claude.api_key, "test-key-123");
    if (original) {
      process.env.ANTHROPIC_API_KEY = original;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});

describe("validateConfig", () => {
  it("returns valid for complete config", () => {
    const config = { claude: { api_key: "test-key" } };
    const result = validateConfig(config, "review");
    assert.equal(result.valid, true);
  });

  it("warns when API key is missing for review", () => {
    const config = { claude: { api_key: null } };
    const result = validateConfig(config, "review");
    assert.equal(result.valid, true);
    assert.ok(result.warning);
  });
});

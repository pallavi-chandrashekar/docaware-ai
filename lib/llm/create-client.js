/**
 * Factory function to create the appropriate LLM client based on config.
 *
 * Supported providers:
 *   - claude (default): Anthropic Claude — requires ANTHROPIC_API_KEY
 *   - openai: OpenAI GPT-4o/GPT-4 — requires OPENAI_API_KEY, npm install openai
 *   - gemini: Google Gemini — requires GOOGLE_API_KEY, npm install @google/generative-ai
 *   - ollama: Local Ollama — no API key, requires Ollama running locally
 */

const PROVIDER_CONFIG = {
  claude: {
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5-20250929",
    module: "./claude-client.js",
    className: "ClaudeClient",
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    module: "./openai-client.js",
    className: "OpenAIClient",
  },
  gemini: {
    envKey: "GOOGLE_API_KEY",
    defaultModel: "gemini-2.0-flash",
    module: "./gemini-client.js",
    className: "GeminiClient",
  },
  ollama: {
    envKey: null,
    defaultModel: "llama3.1",
    module: "./ollama-client.js",
    className: "OllamaClient",
  },
};

/**
 * Auto-detect provider from available environment variables.
 */
function detectProvider() {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GOOGLE_API_KEY) return "gemini";
  return "ollama"; // Fallback to local
}

/**
 * Create an LLM client based on config.
 *
 * @param {object} config - The llm section of config
 * @param {string} [config.provider] - Provider name: claude, openai, gemini, ollama (auto-detected if omitted)
 * @param {string} [config.model] - Model override
 * @param {number} [config.max_tokens] - Max tokens override
 * @param {string} [config.api_key] - API key override
 * @param {object} [config.client] - Injected client for testing
 * @returns {Promise<LLMProvider>}
 */
export async function createLLMClient(config = {}) {
  const provider = config.provider || detectProvider();
  const providerConfig = PROVIDER_CONFIG[provider];

  if (!providerConfig) {
    throw new Error(
      `Unknown LLM provider: "${provider}". Supported: ${Object.keys(PROVIDER_CONFIG).join(", ")}`
    );
  }

  // For testing: if client is injected, wrap it in Claude-compatible interface
  if (config.client) {
    const { ClaudeClient } = await import("./claude-client.js");
    return new ClaudeClient({ client: config.client, model: config.model, maxTokens: config.max_tokens });
  }

  const apiKey = config.api_key || (providerConfig.envKey ? process.env[providerConfig.envKey] : null);
  const model = config.model || providerConfig.defaultModel;
  const maxTokens = config.max_tokens || 4096;

  if (providerConfig.envKey && !apiKey) {
    throw new Error(
      `${providerConfig.envKey} is required for "${provider}" provider. Set it via environment variable or .docaware.yml`
    );
  }

  const mod = await import(providerConfig.module);
  const ClientClass = mod[providerConfig.className];
  return new ClientClass({ apiKey, model, maxTokens });
}

export { PROVIDER_CONFIG };

/**
 * Claude API wrapper with retry, streaming, and token tracking.
 * Uses constructor injection for testability.
 */
export class ClaudeClient {
  constructor({ apiKey, model = "claude-sonnet-4-5-20250929", maxTokens = 4096, client } = {}) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.tokenUsage = { input: 0, output: 0 };

    if (client) {
      this.client = client;
    } else {
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is required. Set it via environment variable or .docaware.yml"
        );
      }
      // Lazy import to avoid loading SDK when not needed
      this._apiKey = apiKey;
      this._clientPromise = null;
    }
  }

  async _getClient() {
    if (this.client) return this.client;
    if (!this._clientPromise) {
      this._clientPromise = import("@anthropic-ai/sdk").then(
        ({ default: Anthropic }) => new Anthropic({ apiKey: this._apiKey })
      );
    }
    return this._clientPromise;
  }

  /**
   * Send a message and get a response.
   * Supports tool_use for structured output.
   */
  async message({ system, messages, tools, toolChoice, maxRetries = 2 }) {
    const client = await this._getClient();

    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
    };

    if (system) params.system = system;
    if (tools) params.tools = tools;
    if (toolChoice) params.tool_choice = toolChoice;

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await client.messages.create(params);

        // Track token usage
        if (response.usage) {
          this.tokenUsage.input += response.usage.input_tokens;
          this.tokenUsage.output += response.usage.output_tokens;
        }

        return response;
      } catch (err) {
        lastError = err;

        // Don't retry on auth errors or invalid requests
        if (err.status === 401 || err.status === 400) throw err;

        // Retry on rate limits and server errors
        if (attempt < maxRetries && (err.status === 429 || err.status >= 500)) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
    }

    throw lastError;
  }

  /**
   * Send a message using tool_use for structured JSON output.
   * Returns the tool input (parsed JSON) directly.
   */
  async structuredOutput({ system, userMessage, toolName, toolDescription, inputSchema }) {
    const response = await this.message({
      system,
      messages: [{ role: "user", content: userMessage }],
      tools: [
        {
          name: toolName,
          description: toolDescription,
          input_schema: inputSchema,
        },
      ],
      toolChoice: { type: "tool", name: toolName },
    });

    // Extract tool use block
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      throw new Error("Expected structured tool_use response but got none");
    }

    return toolUse.input;
  }

  /**
   * Simple text message (no tools).
   */
  async textMessage(system, userMessage) {
    const response = await this.message({
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text || "";
  }

  getTokenUsage() {
    return { ...this.tokenUsage };
  }
}

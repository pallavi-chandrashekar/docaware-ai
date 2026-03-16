/**
 * Claude (Anthropic) LLM provider.
 * Uses native tool_use for structured output.
 */
import { LLMProvider, withRetry } from "./provider.js";

export class ClaudeClient extends LLMProvider {
  constructor({ apiKey, model = "claude-sonnet-4-5-20250929", maxTokens = 4096, client } = {}) {
    super({ model, maxTokens });

    if (client) {
      this.client = client;
    } else {
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is required. Set it via environment variable or .docaware.yml"
        );
      }
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

    return withRetry(
      async () => {
        const response = await client.messages.create(params);
        if (response.usage) {
          this.tokenUsage.input += response.usage.input_tokens;
          this.tokenUsage.output += response.usage.output_tokens;
        }
        return response;
      },
      { maxRetries }
    );
  }

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

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      throw new Error("Expected structured tool_use response but got none");
    }

    return toolUse.input;
  }

  async textMessage(system, userMessage) {
    const response = await this.message({
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.text || "";
  }
}

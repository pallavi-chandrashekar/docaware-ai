/**
 * OpenAI LLM provider (GPT-4o, GPT-4, etc.).
 * Uses function calling for structured output.
 * Requires: npm install openai
 */
import { LLMProvider, withRetry, extractJsonFromText } from "./provider.js";

export class OpenAIClient extends LLMProvider {
  constructor({ apiKey, model = "gpt-4o", maxTokens = 4096, client } = {}) {
    super({ model, maxTokens });

    if (client) {
      this.client = client;
    } else {
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY is required. Set it via environment variable or .docaware.yml"
        );
      }
      this._apiKey = apiKey;
      this._clientPromise = null;
    }
  }

  async _getClient() {
    if (this.client) return this.client;
    if (!this._clientPromise) {
      this._clientPromise = import("openai").then(
        ({ default: OpenAI }) => new OpenAI({ apiKey: this._apiKey })
      );
    }
    return this._clientPromise;
  }

  async message({ system, messages, tools, toolChoice, maxRetries = 2 }) {
    const client = await this._getClient();

    const openaiMessages = [];
    if (system) {
      openaiMessages.push({ role: "system", content: system });
    }
    for (const msg of messages) {
      openaiMessages.push({ role: msg.role, content: msg.content });
    }

    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: openaiMessages,
    };

    if (tools) {
      params.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema || t.inputSchema,
        },
      }));
    }

    if (toolChoice && toolChoice.type === "tool") {
      params.tool_choice = { type: "function", function: { name: toolChoice.name } };
    }

    return withRetry(
      async () => {
        const response = await client.chat.completions.create(params);
        if (response.usage) {
          this.tokenUsage.input += response.usage.prompt_tokens;
          this.tokenUsage.output += response.usage.completion_tokens;
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
      tools: [{ name: toolName, description: toolDescription, input_schema: inputSchema }],
      toolChoice: { type: "tool", name: toolName },
    });

    const choice = response.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    // Fallback: extract JSON from text content
    const text = choice?.message?.content || "";
    return extractJsonFromText(text);
  }

  async textMessage(system, userMessage) {
    const response = await this.message({
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    return response.choices?.[0]?.message?.content || "";
  }
}

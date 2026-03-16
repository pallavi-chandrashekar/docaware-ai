/**
 * Google Gemini LLM provider.
 * Uses function calling for structured output.
 * Requires: npm install @google/generative-ai
 */
import { LLMProvider, withRetry, extractJsonFromText } from "./provider.js";

export class GeminiClient extends LLMProvider {
  constructor({ apiKey, model = "gemini-2.0-flash", maxTokens = 4096, client } = {}) {
    super({ model, maxTokens });

    if (client) {
      this.client = client;
    } else {
      if (!apiKey) {
        throw new Error(
          "GOOGLE_API_KEY is required. Set it via environment variable or .docaware.yml"
        );
      }
      this._apiKey = apiKey;
      this._clientPromise = null;
    }
  }

  async _getClient() {
    if (this.client) return this.client;
    if (!this._clientPromise) {
      this._clientPromise = import("@google/generative-ai").then(({ GoogleGenerativeAI }) => {
        const genAI = new GoogleGenerativeAI(this._apiKey);
        return genAI.getGenerativeModel({ model: this.model });
      });
    }
    return this._clientPromise;
  }

  async message({ system, messages, tools, maxRetries = 2 }) {
    const model = await this._getClient();

    const parts = [];
    if (system) {
      parts.push({ text: `System: ${system}\n\n` });
    }
    for (const msg of messages) {
      parts.push({ text: `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}` });
    }

    // If tools requested, append instruction to return JSON
    if (tools && tools.length > 0) {
      const schema = tools[0].input_schema || tools[0].inputSchema;
      parts.push({
        text: `\n\nYou MUST respond with ONLY a JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include any text outside the JSON.`,
      });
    }

    return withRetry(
      async () => {
        const result = await model.generateContent({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: this.maxTokens },
        });

        const response = result.response;
        const usage = response.usageMetadata;
        if (usage) {
          this.tokenUsage.input += usage.promptTokenCount || 0;
          this.tokenUsage.output += usage.candidatesTokenCount || 0;
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
    });

    const text = response.text();
    return extractJsonFromText(text);
  }

  async textMessage(system, userMessage) {
    const response = await this.message({
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    return response.text();
  }
}

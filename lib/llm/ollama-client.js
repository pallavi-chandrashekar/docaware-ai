/**
 * Ollama LLM provider for local models (Llama, Mistral, CodeLlama, etc.).
 * No API key needed — runs locally via Ollama.
 * Requires: Ollama installed and running (https://ollama.com)
 */
import { LLMProvider, withRetry, extractJsonFromText } from "./provider.js";

export class OllamaClient extends LLMProvider {
  constructor({ model = "llama3.1", maxTokens = 4096, baseUrl = "http://localhost:11434" } = {}) {
    super({ model, maxTokens });
    this.baseUrl = baseUrl;
  }

  async message({ system, messages, tools, maxRetries = 2 }) {
    const ollamaMessages = [];
    if (system) {
      ollamaMessages.push({ role: "system", content: system });
    }
    for (const msg of messages) {
      ollamaMessages.push({ role: msg.role, content: msg.content });
    }

    // If tools requested, append JSON instruction to the last message
    if (tools && tools.length > 0) {
      const schema = tools[0].input_schema || tools[0].inputSchema;
      const last = ollamaMessages[ollamaMessages.length - 1];
      last.content += `\n\nYou MUST respond with ONLY a JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include any text outside the JSON.`;
    }

    const body = {
      model: this.model,
      messages: ollamaMessages,
      stream: false,
      options: { num_predict: this.maxTokens },
    };

    return withRetry(
      async () => {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = new Error(`Ollama error: ${response.status} ${response.statusText}`);
          err.status = response.status;
          throw err;
        }

        const data = await response.json();

        if (data.prompt_eval_count || data.eval_count) {
          this.tokenUsage.input += data.prompt_eval_count || 0;
          this.tokenUsage.output += data.eval_count || 0;
        }

        return data;
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

    const text = response.message?.content || "";
    return extractJsonFromText(text);
  }

  async textMessage(system, userMessage) {
    const response = await this.message({
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    return response.message?.content || "";
  }
}

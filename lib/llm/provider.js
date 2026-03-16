/**
 * Abstract LLM provider interface.
 * All providers must implement: message(), structuredOutput(), textMessage(), getTokenUsage().
 */
export class LLMProvider {
  constructor({ model, maxTokens = 4096 } = {}) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.tokenUsage = { input: 0, output: 0 };
  }

  async message(/* { system, messages, tools, toolChoice, maxRetries } */) {
    throw new Error("message() must be implemented by subclass");
  }

  async structuredOutput(/* { system, userMessage, toolName, toolDescription, inputSchema } */) {
    throw new Error("structuredOutput() must be implemented by subclass");
  }

  async textMessage(/* system, userMessage */) {
    throw new Error("textMessage() must be implemented by subclass");
  }

  getTokenUsage() {
    return { ...this.tokenUsage };
  }
}

/**
 * Retry helper with exponential backoff.
 */
export async function withRetry(fn, { maxRetries = 2, retryableStatus = [429, 500, 502, 503] } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode;
      if (status === 401 || status === 400) throw err;
      if (attempt < maxRetries && (retryableStatus.includes(status) || !status)) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }
  throw lastError;
}

/**
 * Parse structured JSON from a text response (for providers without native tool-use).
 * Extracts JSON from markdown code blocks or raw JSON.
 */
export function extractJsonFromText(text) {
  // Try markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // Try raw JSON (find first { to last })
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  throw new Error("Could not extract JSON from LLM response");
}

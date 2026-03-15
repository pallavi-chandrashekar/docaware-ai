// Benchmark fixture: code with known deprecated OpenAI v3 API usage
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// GROUND TRUTH: deprecated_api - Configuration class removed in v4
// GROUND TRUTH: deprecated_api - OpenAIApi class removed in v4

export async function chatCompletion(prompt) {
  // GROUND TRUTH: deprecated_api - createChatCompletion removed in v4
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
  });

  return response.data.choices[0].message.content;
}

export async function textCompletion(prompt) {
  // GROUND TRUTH: deprecated_api - createCompletion removed in v4
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: prompt,
    max_tokens: 100,
  });

  return response.data.choices[0].text;
}

export async function createEmbedding(text) {
  // GROUND TRUTH: deprecated_api - createEmbedding API changed in v4
  const response = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response.data.data[0].embedding;
}

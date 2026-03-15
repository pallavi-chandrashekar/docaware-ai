// Benchmark fixture: streaming code with known issues
import { Configuration, OpenAIApi } from "openai";

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

export async function streamChat(prompt) {
  // GROUND TRUTH: incorrect_usage - responseType/onDownloadProgress pattern removed in v4
  const response = await openai.createChatCompletion(
    {
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      stream: true,
    },
    { responseType: "stream" }
  );

  // GROUND TRUTH: incorrect_usage - v4 uses async iterators, not .on("data")
  response.data.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const json = line.slice(6);
        if (json === "[DONE]") return;
        const parsed = JSON.parse(json);
        process.stdout.write(parsed.choices[0]?.delta?.content || "");
      }
    }
  });
}

export async function generateImage(prompt) {
  // GROUND TRUTH: deprecated_api - createImage API changed in v4
  const response = await openai.createImage({
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });

  return response.data.data[0].url;
}

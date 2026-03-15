# OpenAI Node.js SDK v4.0 Migration Guide

## Breaking Changes

### Client Initialization
The `Configuration` class and `OpenAIApi` class have been **removed**.

Old (v3):
```js
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({ apiKey: "sk-..." });
const openai = new OpenAIApi(configuration);
```

New (v4):
```js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: "sk-..." });
```

### Chat Completions
`createChatCompletion()` has been **removed**. Use `client.chat.completions.create()`.

Old (v3):
```js
const response = await openai.createChatCompletion({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hello" }],
});
const text = response.data.choices[0].message.content;
```

New (v4):
```js
const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hello" }],
});
const text = response.choices[0].message.content;
```

### Text Completions
`createCompletion()` has been **removed**. The `text-davinci-003` model is deprecated.

Old (v3):
```js
const response = await openai.createCompletion({
  model: "text-davinci-003",
  prompt: "Hello",
});
```

New (v4):
```js
const response = await openai.completions.create({
  model: "gpt-3.5-turbo-instruct",
  prompt: "Hello",
});
```

### Embeddings
`createEmbedding()` has been **renamed** to `client.embeddings.create()`.

Old (v3):
```js
const response = await openai.createEmbedding({
  model: "text-embedding-ada-002",
  input: "Hello",
});
const embedding = response.data.data[0].embedding;
```

New (v4):
```js
const response = await openai.embeddings.create({
  model: "text-embedding-ada-002",
  input: "Hello",
});
const embedding = response.data[0].embedding;
```

### Image Generation
`createImage()` has been **renamed** to `client.images.generate()`.

Old (v3):
```js
const response = await openai.createImage({ prompt: "A cat", n: 1, size: "1024x1024" });
```

New (v4):
```js
const response = await openai.images.generate({ prompt: "A cat", n: 1, size: "1024x1024" });
```

### Streaming
The `responseType: "stream"` option and `.on("data")` pattern are **removed**.

Old (v3):
```js
const response = await openai.createChatCompletion(
  { model: "gpt-4", messages: [...], stream: true },
  { responseType: "stream" }
);
response.data.on("data", (chunk) => { ... });
```

New (v4):
```js
const stream = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

### Response Format
In v4, responses no longer have a `.data` wrapper. Access properties directly:
- `response.data.choices` → `response.choices`
- `response.data.data` → `response.data`

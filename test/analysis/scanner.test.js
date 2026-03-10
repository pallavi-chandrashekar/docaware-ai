import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseJsFile } from "../../lib/analysis/scanner.js";

describe("parseJsFile", () => {
  it("extracts function calls", () => {
    const code = `import { fetch } from 'node-fetch';\nfetch("https://api.example.com");`;
    const idents = parseJsFile(code, "test.js");
    assert.ok(idents !== null);
    assert.ok(idents.some((i) => i.name === "fetch" && i.type === "call"));
  });

  it("extracts method calls", () => {
    const code = `const result = client.chat.completions.create({ model: "gpt-4" });`;
    const idents = parseJsFile(code, "test.js");
    assert.ok(idents !== null);
    assert.ok(idents.some((i) => i.name === "client.chat.completions.create" && i.type === "method_call"));
  });

  it("extracts imports", () => {
    const code = `import { OpenAI } from 'openai';`;
    const idents = parseJsFile(code, "test.js");
    assert.ok(idents !== null);
    assert.ok(idents.some((i) => i.name === "OpenAI" && i.type === "import" && i.source === "openai"));
  });

  it("extracts new expressions", () => {
    const code = `const client = new OpenAI({ apiKey: 'sk-...' });`;
    const idents = parseJsFile(code, "test.js");
    assert.ok(idents !== null);
    assert.ok(idents.some((i) => i.name === "OpenAI" && i.type === "new"));
  });

  it("handles TypeScript files", () => {
    const code = `
import type { ChatCompletion } from 'openai';
const client: OpenAI = new OpenAI({ apiKey: key });
const result = await client.chat.completions.create({ model: "gpt-4" });
`;
    const idents = parseJsFile(code, "test.ts");
    assert.ok(idents !== null);
    assert.ok(idents.some((i) => i.name === "OpenAI" && i.type === "new"));
  });

  it("returns null for unparseable code", () => {
    const code = "this is not valid javascript {{{}}}";
    const idents = parseJsFile(code, "test.js");
    assert.equal(idents, null);
  });
});

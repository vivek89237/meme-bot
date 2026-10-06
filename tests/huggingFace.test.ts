import assert from "node:assert/strict";
import { test } from "node:test";
import { chatCompletion } from "../src/services/huggingFace.js";

test("proxy-bound tokens stay unchanged and requests use Hugging Face's HTTPS router", async (t) => {
  const previous = process.env.HF_TOKEN;
  process.env.HF_TOKEN = "proxy-binding-test-only";
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://router.huggingface.co/v1/chat/completions");
    assert.equal(
      new Headers(init.headers).get("authorization"),
      "Bearer proxy-binding-test-only",
    );
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "test/model:novita");
    assert.ok(!String(init.body).includes("proxy-binding-test-only"));
    return Response.json({ choices: [{ message: { content: "OK" } }] });
  });
  try {
    const response = await chatCompletion({
      model: "test/model",
      provider: "novita",
      messages: [{ role: "user", content: "Reply OK" }],
    });
    assert.equal(response.choices[0]?.message.content, "OK");
  } finally {
    if (previous === undefined) delete process.env.HF_TOKEN;
    else process.env.HF_TOKEN = previous;
  }
});

test("provider failures omit response bodies and empty reasoning-only answers fail clearly", async (t) => {
  const previous = process.env.HF_TOKEN;
  process.env.HF_TOKEN = "test-only";
  try {
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: "test-only" }, { status: 403 }),
    );
    await assert.rejects(
      chatCompletion({ model: "test/model", messages: [] }),
      (error: Error) =>
        error.message.includes("HTTP 403") &&
        !error.message.includes("test-only"),
    );
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({
        choices: [{ message: { content: "" }, finish_reason: "length" }],
      }),
    );
    await assert.rejects(
      chatCompletion({ model: "test/model", messages: [] }),
      /no answer.*length/,
    );
  } finally {
    if (previous === undefined) delete process.env.HF_TOKEN;
    else process.env.HF_TOKEN = previous;
  }
});

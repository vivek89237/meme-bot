import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInstagramContainer,
  waitForInstagramContainer,
  publishToInstagram,
} from "../src/services/instagram.js";
import { uploadImage } from "../src/services/storage.js";
import { runAgent } from "../src/workflows/agent.js";

test("importing the workflow does not start it or require credentials", () => {
  assert.equal(typeof runAgent, "function");
});

test("Instagram creates a container, handles processing and publishes with mocked HTTP", async (t) => {
  const original = {
    token: process.env.INSTAGRAM_ACCESS_TOKEN,
    id: process.env.INSTAGRAM_USER_ID,
  };
  process.env.INSTAGRAM_ACCESS_TOKEN = "IG-test";
  process.env.INSTAGRAM_USER_ID = "test-user";
  const responses = [
    { id: "container" },
    { status_code: "IN_PROGRESS" },
    { status_code: "FINISHED" },
    { id: "post" },
    { permalink: "https://example.com/post" },
  ];
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return Response.json(responses.shift());
    },
  );
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    assert.equal(
      await createInstagramContainer(
        "https://example.com/image.png",
        "caption",
      ),
      "container",
    );
    const wait = waitForInstagramContainer("container");
    t.mock.timers.tick(5000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.mock.timers.tick(5000);
    await wait;
    assert.equal(
      await publishToInstagram("container"),
      "https://example.com/post",
    );
    assert.equal(calls.length, 5);
    assert.ok(calls[0]?.url.includes("test-user/media"));
    assert.equal(
      new URLSearchParams(calls[0]?.init?.body as URLSearchParams).get(
        "caption",
      ),
      "caption",
    );
    assert.ok(calls[3]?.url.includes("media_publish"));
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: { message: "rejected" } }, { status: 400 }),
    );
    await assert.rejects(
      createInstagramContainer("image", "caption"),
      /media creation failed/,
    );
  } finally {
    for (const [name, value] of Object.entries({
      INSTAGRAM_ACCESS_TOKEN: original.token,
      INSTAGRAM_USER_ID: original.id,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("Storage uploads JPEG bytes and returns a signed URL for a private bucket", async (t) => {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_BUCKET",
  ];
  const previous = names.map((name) => process.env[name]);
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
  process.env.SUPABASE_BUCKET = "Meme";
  const calls: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).includes("/object/sign/"))
        return Response.json({
          signedURL: "/object/sign/Meme/test.jpg?token=test",
        });
      assert.equal(
        new Headers(init?.headers).get("content-type"),
        "image/jpeg",
      );
      return Response.json({ Key: "Meme/test.jpg" });
    },
  );
  try {
    const url = await uploadImage(Buffer.from("test-image"), "image/jpeg");
    assert.ok(calls[0]?.includes("/object/Meme/"));
    assert.ok(calls[0]?.endsWith(".jpg"));
    assert.equal(calls.length, 2);
    assert.ok(url.includes("/storage/v1/object/sign/Meme/"));
  } finally {
    names.forEach((name, index) => {
      const value = previous[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { generateMeme } from "../src/memes/generate.js";
import { reviewMeme } from "../src/memes/review.js";
import { selectBestIdea } from "../src/services/ideas.js";
import { getEnv, getInstagramConfig } from "../src/config/env.js";

test("generated memes have usable captions, categories and hashes", async () => {
  const meme = await generateMeme();
  assert.ok(meme.caption.includes("#memes"));
  assert.ok(meme.category);
  assert.match(meme.hash, /^[0-9a-f]+$/);
  assert.equal((await reviewMeme(meme.caption)).status, "approved");
});

test("review rejects empty and short captions", async () => {
  assert.equal((await reviewMeme("  ")).ai_score, 0);
  assert.equal((await reviewMeme("short")).status, "rejected");
});

test("selection chooses the highest score without mutating the input", () => {
  const ideas = [
    { text: "first", category: "coding", hash: "1", score: 70, reason: "ok" },
    {
      text: "second",
      category: "coding",
      hash: "2",
      score: 90,
      reason: "good",
    },
  ];
  assert.equal(selectBestIdea(ideas), ideas[1]);
  assert.equal(ideas[0]?.text, "first");
  assert.equal(selectBestIdea([]), null);
  assert.equal(selectBestIdea([{ ...ideas[0]!, score: 69 }]), null);
});

test("environment validation and Instagram host selection", () => {
  const previousToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const previousId = process.env.INSTAGRAM_USER_ID;
  const previousVersion = process.env.GRAPH_API_VERSION;
  try {
    process.env.INSTAGRAM_USER_ID = "test-user";
    process.env.GRAPH_API_VERSION = "v24.0";
    process.env.INSTAGRAM_ACCESS_TOKEN = " IG-test ";
    assert.equal(getInstagramConfig().host, "https://graph.instagram.com");
    process.env.INSTAGRAM_ACCESS_TOKEN = "facebook-test";
    assert.equal(
      getInstagramConfig().graphUrl("media"),
      "https://graph.facebook.com/v24.0/media",
    );
    process.env.INSTAGRAM_ACCESS_TOKEN = " ";
    assert.throws(
      () => getEnv("INSTAGRAM_ACCESS_TOKEN"),
      /Missing environment variable/,
    );
  } finally {
    for (const [name, value] of Object.entries({
      INSTAGRAM_ACCESS_TOKEN: previousToken,
      INSTAGRAM_USER_ID: previousId,
      GRAPH_API_VERSION: previousVersion,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

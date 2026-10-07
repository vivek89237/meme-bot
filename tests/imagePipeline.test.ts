import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import { validateCaption } from "../src/memes/caption.js";
import { getImageConfig } from "../src/config/images.js";
import { parseIdeas, parseCaptionReview } from "../src/services/ideas.js";
import { buildImageRequest, generateImage } from "../src/services/images.js";
import { layoutCaption, renderMeme } from "../src/services/renderMeme.js";
import {
  ImageQualityError,
  parseImageReview,
  reviewImage,
  validateImageBytes,
} from "../src/services/imageQuality.js";
import { createMemeImage } from "../src/workflows/createMeme.js";
import { runAgent } from "../src/workflows/agent.js";
import type { MemeIdea } from "../src/memes/types.js";

const idea: MemeIdea = {
  topText: "Finally fixed the bug.",
  bottomText: "Accidentally added three new features.",
  visualPrompt:
    "A relieved developer celebrating while three warning lights glow behind them.",
  category: "debugging",
  text: "Finally fixed the bug.\nAccidentally added three new features.",
  hash: "test",
};
const names = [
  "HF_TOKEN",
  "HF_MODEL",
  "HF_IMAGE_MODEL",
  "HF_IMAGE_MODE",
  "HF_REFERENCE_MODEL",
  "HF_CHARACTER_REFERENCES",
  "HF_IMAGE_PROVIDER",
  "HF_IMAGE_STEPS",
  "HF_IMAGE_GUIDANCE",
  "HF_IMAGE_SEED",
  "HF_VISION_MODEL",
  "HF_VISION_PROVIDER",
  "MEME_TEMPLATE",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INSTAGRAM_USER_ID",
  "INSTAGRAM_ACCESS_TOKEN",
];
let previous: (string | undefined)[];
beforeEach(() => {
  previous = names.map((name) => process.env[name]);
  names.forEach((name) => delete process.env[name]);
});
afterEach(() =>
  names.forEach((name, index) => {
    const value = previous[index];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }),
);

function artwork(): Promise<Buffer> {
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><defs><linearGradient id="g"><stop stop-color="#1b7280"/><stop offset="1" stop-color="#ffa94d"/></linearGradient></defs><rect width="1024" height="768" fill="url(#g)"/><circle cx="512" cy="384" r="160" fill="#184050"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
}
const approved = {
  score: 90,
  reason: "Clear scene",
  artworkHasText: false,
  sharp: true,
  compositionClear: true,
  matchesScene: true,
};

// No request in this test file can reach a live provider.
test("structured ideas retain exact captions and filter malformed, repeated and oversized text", () => {
  const valid = {
    topText: idea.topText,
    bottomText: idea.bottomText,
    visualPrompt: idea.visualPrompt,
    category: idea.category,
  };
  const result = parseIdeas(
    JSON.stringify([
      valid,
      { ...valid, bottomText: "just just added features" },
      { ...valid, topText: "x".repeat(91) },
      { ...valid, visualPrompt: "" },
      null,
    ]),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]?.text, idea.text);
  assert.equal(result[0]?.topText, idea.topText);
  assert.equal(
    parseIdeas(JSON.stringify([{ ...valid, bottomText: valid.topText }]))
      .length,
    0,
  );
  assert.throws(
    () => validateCaption("Just just added features"),
    /repeated words/,
  );
  assert.throws(() => validateCaption("word ".repeat(15)), /at most/);
});

test("caption review rejects typos and malformed or non-finite scores", () => {
  const review = {
    score: 90,
    reason: "Funny",
    grammarCorrect: true,
    spellingCorrect: true,
    noRepeatedWords: true,
    visualPromptHasNoText: true,
  };
  assert.equal(parseCaptionReview(JSON.stringify(review)).score, 90);
  for (const field of [
    "grammarCorrect",
    "spellingCorrect",
    "noRepeatedWords",
    "visualPromptHasNoText",
  ]) {
    assert.equal(
      parseCaptionReview(JSON.stringify({ ...review, [field]: false })).score,
      0,
    );
  }
  assert.throws(
    () => parseCaptionReview(JSON.stringify({ ...review, score: "90" })),
    /Invalid/,
  );
  assert.throws(
    () => parseCaptionReview(JSON.stringify({ ...review, score: 101 })),
    /Invalid/,
  );
});

test("model and provider are explicit with fixed artwork size and bounded quality settings", () => {
  process.env.HF_IMAGE_SEED = "42";
  const request = buildImageRequest(idea.visualPrompt);
  assert.equal(request.provider, "fal-ai");
  assert.equal(request.model, "black-forest-labs/FLUX.1-dev");
  assert.ok("image_size" in request.parameters);
  assert.deepEqual(request.parameters.image_size, { width: 1024, height: 768 });
  assert.equal(request.parameters.num_inference_steps, 28);
  assert.equal(request.parameters.guidance_scale, 3.5);
  assert.equal(request.parameters.seed, 42);
  assert.equal(buildImageRequest(idea.visualPrompt, 1).parameters.seed, 43);
  assert.ok(request.inputs.includes("No text, letters"));
  assert.ok(!request.inputs.includes(idea.topText));
  process.env.HF_IMAGE_PROVIDER = "together";
  const together = buildImageRequest(idea.visualPrompt);
  assert.ok("width" in together.parameters);
  assert.equal(together.parameters.width, 1024);
  assert.equal(together.parameters.height, 768);
  process.env.HF_IMAGE_PROVIDER = "auto";
  assert.throws(getImageConfig, /auto routing/);
  process.env.HF_IMAGE_PROVIDER = "together";
  process.env.HF_IMAGE_STEPS = "NaN";
  assert.throws(getImageConfig, /HF_IMAGE_STEPS/);
});

test("generation sends only scene artwork and explicit settings through the SDK adapter", async (t) => {
  process.env.HF_TOKEN = "hf_test_only";
  const png = await artwork();
  let posted = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL, init?: RequestInit) => {
      const address = String(url);
      if (address.includes("huggingface.co/api/models/")) {
        return Response.json({
          inferenceProviderMapping: {
            "fal-ai": {
              providerId: "fal-ai/flux/dev",
              status: "live",
              task: "text-to-image",
            },
          },
        });
      }
      if (init?.method === "POST") {
        assert.ok(address.startsWith("https://router.huggingface.co/fal-ai/"));
        const payload = JSON.parse(String(init.body));
        assert.ok(!payload.prompt.includes(idea.bottomText));
        assert.deepEqual(payload.image_size, { width: 1024, height: 768 });
        assert.equal(payload.num_inference_steps, 28);
        posted = true;
        return Response.json({
          request_id: "request",
          status: "COMPLETED",
          response_url:
            "https://queue.fal.run/fal-ai/flux/dev/requests/request",
        });
      }
      if (address.includes("/requests/request"))
        return Response.json({
          images: [{ url: "https://example.com/art.png" }],
        });
      if (address === "https://example.com/art.png")
        return new Response(new Uint8Array(png), {
          headers: { "content-type": "image/png" },
        });
      throw new Error(`Unexpected mocked route: ${address}`);
    },
  );
  assert.deepEqual(await generateImage(idea.visualPrompt), png);
  assert.ok(posted);
});

test("renderer wraps exact text, creates a deterministic 1080x1350 JPEG and supports both templates", async () => {
  const art = await artwork();
  const layout = layoutCaption(idea.bottomText);
  assert.equal(layout.lines.join(" "), idea.bottomText);
  assert.ok(layout.fontSize >= 48);
  assert.ok(layout.lines.length <= 3);
  const light = await renderMeme(art, idea.topText, idea.bottomText);
  const second = await renderMeme(art, idea.topText, idea.bottomText);
  assert.deepEqual(light, second);
  const metadata = await sharp(light).metadata();
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1350);
  assert.equal(metadata.format, "jpeg");
  const corner = await sharp(light)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok(corner.every((channel) => channel > 245));
  const panelStats = await sharp(light)
    .extract({ left: 48, top: 36, width: 984, height: 198 })
    .stats();
  assert.ok(
    panelStats.channels[0]!.min < 40,
    "caption panel must actually contain rendered ink",
  );
  process.env.MEME_TEMPLATE = "dark";
  const dark = await renderMeme(art, idea.topText, idea.bottomText);
  assert.notDeepEqual(dark, light);
  await validateImageBytes(dark, "final");
  assert.throws(() => layoutCaption("W".repeat(90)), /does not fit/);
  assert.throws(() => layoutCaption("A bug 🫠"), /unsupported/);
});

test("local quality gates reject low resolution, blank, corrupted and wrong final formats", async () => {
  await validateImageBytes(await artwork(), "artwork");
  const tiny = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(validateImageBytes(tiny, "artwork"), /at least/);
  const blank = await sharp({
    create: { width: 1024, height: 768, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(validateImageBytes(blank, "artwork"), /blank/);
  await assert.rejects(
    validateImageBytes(Buffer.from("not-an-image"), "artwork"),
    /decoded/,
  );
  await assert.rejects(validateImageBytes(await artwork(), "final"), /1080/);
});

test("vision reviews reject unwanted lettering, blur, poor composition and caption mismatch", () => {
  parseImageReview(JSON.stringify(approved), "artwork", idea);
  for (const bad of [
    { artworkHasText: true },
    { sharp: false },
    { compositionClear: false },
    { matchesScene: false },
    { score: 79 },
  ]) {
    assert.throws(
      () =>
        parseImageReview(
          JSON.stringify({ ...approved, ...bad }),
          "artwork",
          idea,
        ),
      ImageQualityError,
    );
  }
  const final = {
    ...approved,
    topTextRead: idea.topText,
    bottomTextRead: idea.bottomText,
    textClipped: false,
  };
  parseImageReview(JSON.stringify(final), "final", idea);
  assert.throws(
    () =>
      parseImageReview(
        JSON.stringify({
          ...final,
          bottomTextRead: "Accidentaly added features.",
        }),
        "final",
        idea,
      ),
    /did not match/,
  );
  assert.throws(
    () =>
      parseImageReview(
        JSON.stringify({ ...final, textClipped: true }),
        "final",
        idea,
      ),
    /clipped/,
  );
  assert.throws(
    () => parseImageReview('{"score":90}', "artwork", idea),
    /Invalid/,
  );
});

test("vision review sends the actual image and obtains independent exact-text transcription", async (t) => {
  process.env.HF_TOKEN = "test-only";
  process.env.HF_VISION_MODEL = "test-vision-model";
  process.env.HF_VISION_PROVIDER = "together";
  const final = await renderMeme(
    await artwork(),
    idea.topText,
    idea.bottomText,
  );
  let posted = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("huggingface.co/api/models/")) {
        return Response.json({
          inferenceProviderMapping: {
            together: {
              providerId: "test-vision-model",
              status: "live",
              task: "conversational",
            },
          },
        });
      }
      assert.ok(String(url).includes("/chat/completions"));
      const request = JSON.parse(String(init?.body));
      assert.equal(request.model, "test-vision-model:together");
      const content = request.messages[0].content;
      assert.ok(content[1].image_url.url.startsWith("data:image/jpeg;base64,"));
      assert.ok(
        !content[0].text.includes(idea.topText),
        "reviewer must independently transcribe the rendered caption",
      );
      posted = true;
      return Response.json({
        id: "test",
        model: "test-vision-model",
        created: 1,
        usage: {},
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...approved,
                topTextRead: idea.topText,
                bottomTextRead: idea.bottomText,
                textClipped: false,
              }),
            },
          },
        ],
      });
    },
  );
  await reviewImage(final, "final", idea);
  assert.ok(posted);
});

test("meme creation reviews artwork, renders exact captions, then reviews final bytes", async () => {
  const calls: string[] = [];
  const art = await artwork();
  const final = await createMemeImage(idea, {
    generateImage: async (prompt) => {
      calls.push("generate");
      assert.equal(prompt, idea.visualPrompt);
      return art;
    },
    renderMeme: async (image, top, bottom) => {
      calls.push("render");
      assert.equal(top, idea.topText);
      assert.equal(bottom, idea.bottomText);
      return renderMeme(image, top, bottom);
    },
    reviewImage: async (image, stage) => {
      calls.push(stage);
      await validateImageBytes(image, stage);
    },
  });
  assert.deepEqual(calls, ["generate", "artwork", "render", "final"]);
  await validateImageBytes(final, "final");
});

test("failed visual quality retries once, and an unavailable reviewer blocks immediately", async () => {
  const art = await artwork();
  let attempts = 0;
  await assert.rejects(
    createMemeImage(idea, {
      generateImage: async (_prompt, attempt) => {
        assert.equal(attempt, attempts++);
        return art;
      },
      renderMeme,
      reviewImage: async () => {
        throw new ImageQualityError("Unwanted text");
      },
    }),
    /Unwanted text/,
  );
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(
    createMemeImage(idea, {
      generateImage: async () => {
        attempts++;
        return art;
      },
      renderMeme,
      reviewImage: async () => {
        throw new Error("Reviewer unavailable");
      },
    }),
    /Reviewer unavailable/,
  );
  assert.equal(attempts, 1);
  await assert.rejects(
    createMemeImage({ ...idea, topText: "x".repeat(91) }),
    /Caption/,
  );
});

test("agent requires a vision reviewer before any paid generation or external write", async (t) => {
  process.env.HF_TOKEN = "hf_test_only";
  process.env.HF_MODEL = "test-chat-model";
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
  process.env.INSTAGRAM_USER_ID = "test-user";
  process.env.INSTAGRAM_ACCESS_TOKEN = "IG-test";
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    throw new Error("No network request should occur");
  });
  await assert.rejects(
    runAgent(),
    /Missing environment variable: HF_VISION_MODEL/,
  );
  assert.equal(requests, 0);
});

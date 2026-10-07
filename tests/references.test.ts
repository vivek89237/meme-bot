import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, test } from "node:test";
import sharp from "sharp";
import { loadCharacterReferences } from "../src/services/characterReferences.js";
import { getImageConfig } from "../src/config/images.js";
import { buildImageRequest } from "../src/services/images.js";
import { textToImage } from "../src/services/huggingFace.js";
import { parseImageReview, reviewImage } from "../src/services/imageQuality.js";

const names = [
  "HF_IMAGE_MODE",
  "HF_CHARACTER_REFERENCES",
  "HF_REFERENCE_MODEL",
  "HF_IMAGE_PROVIDER",
  "HF_TOKEN",
  "HF_VISION_MODEL",
  "HF_VISION_PROVIDER",
];
let previous: (string | undefined)[];
let folder: string;
beforeEach(async () => {
  previous = names.map((name) => process.env[name]);
  names.forEach((name) => delete process.env[name]);
  folder = await mkdtemp(join(tmpdir(), "meme-refs-"));
});
afterEach(async () => {
  names.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name];
    else process.env[name] = previous[index];
  });
  await rm(folder, { recursive: true, force: true });
});
async function reference() {
  const path = join(folder, "reference.png");
  const png = await sharp({
    create: { width: 256, height: 256, channels: 3, background: "pink" },
  })
    .png()
    .toBuffer();
  await writeFile(path, png);
  process.env.HF_IMAGE_MODE = "reference";
  process.env.HF_CHARACTER_REFERENCES = JSON.stringify([path]);
  return (await loadCharacterReferences())!;
}
const idea = {
  topText: "Time for work.",
  bottomText: "Time for a hug.",
  visualPrompt: "Two bears cuddling",
  text: "",
  category: "cuddles",
  hash: "1",
};
const approved = {
  score: 90,
  reason: "Clear",
  artworkHasText: false,
  sharp: true,
  compositionClear: true,
  matchesScene: true,
};

test("reference mode validates files, retains one sheet and selects an editing model", async () => {
  assert.equal(await loadCharacterReferences(), undefined);
  process.env.HF_IMAGE_MODE = "reference";
  await assert.rejects(loadCharacterReferences(), /requires/);
  const sheet = await reference();
  assert.equal((await sharp(sheet).metadata()).width, 256);
  assert.equal(getImageConfig().model, "black-forest-labs/FLUX.1-Kontext-dev");
  assert.ok(buildImageRequest("A cuddle").inputs.includes("identity source"));
  process.env.HF_CHARACTER_REFERENCES = JSON.stringify([
    join(folder, "missing.png"),
  ]);
  await assert.rejects(loadCharacterReferences(), /Cannot read/);
  process.env.HF_CHARACTER_REFERENCES = "not JSON";
  await assert.rejects(loadCharacterReferences(), /JSON array/);
});

test("separate references are composed without cropping and corrupt images fail", async () => {
  await reference();
  const path = join(folder, "reference.png");
  process.env.HF_CHARACTER_REFERENCES = JSON.stringify([path, path]);
  const metadata = await sharp((await loadCharacterReferences())!).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 512);
  await writeFile(path, "not an image");
  await assert.rejects(loadCharacterReferences(), /readable/);
});

test("reference bytes and scene prompt reach the editing API through the HF router", async (t) => {
  const sheet = await reference();
  process.env.HF_TOKEN = "test-only";
  let posted = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/models/"))
        return Response.json({
          inferenceProviderMapping: {
            "fal-ai": {
              status: "live",
              task: "image-to-image",
              providerId: "fal-ai/flux-kontext/dev",
            },
          },
        });
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        assert.ok(body.image_url.startsWith("data:image/png;base64,"));
        assert.equal(body.prompt, buildImageRequest("A cuddle").inputs);
        assert.equal(body.aspect_ratio, "4:3");
        assert.ok(
          String(url).startsWith("https://router.huggingface.co/fal-ai/"),
        );
        posted = true;
        return Response.json({
          request_id: "ref",
          status: "COMPLETED",
          response_url:
            "https://queue.fal.run/fal-ai/flux-kontext/dev/requests/ref",
        });
      }
      if (String(url).includes("/requests/ref"))
        return Response.json({
          images: [{ url: "https://example.com/ref.png" }],
        });
      if (String(url) === "https://example.com/ref.png")
        return new Response(new Uint8Array(sheet), {
          headers: { "content-type": "image/png" },
        });
      throw new Error("Unexpected request");
    },
  );
  const result = await textToImage(buildImageRequest("A cuddle"), sheet);
  assert.ok(result instanceof Blob);
  assert.ok(posted);
});

test("a text-only model never silently ignores reference inputs", async (t) => {
  const sheet = await reference();
  process.env.HF_TOKEN = "test-only";
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      inferenceProviderMapping: {
        "fal-ai": {
          status: "live",
          task: "text-to-image",
          providerId: "fal-ai/flux/dev",
        },
      },
    }),
  );
  await assert.rejects(
    textToImage(buildImageRequest("A cuddle"), sheet),
    /image-editing model/,
  );
});

test("vision gate requires reference agreement and actually sends both images", async (t) => {
  await reference();
  assert.throws(
    () => parseImageReview(JSON.stringify(approved), "artwork", idea),
    /Missing character/,
  );
  assert.throws(
    () =>
      parseImageReview(
        JSON.stringify({ ...approved, charactersMatchReferences: false }),
        "artwork",
        idea,
      ),
    /appearance differs/,
  );
  process.env.HF_TOKEN = "test-only";
  process.env.HF_VISION_MODEL = "test/vision";
  process.env.HF_VISION_PROVIDER = "novita";
  const art = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="1024" height="768" fill="white"/><circle cx="512" cy="384" r="250" fill="black"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body));
      const images = payload.messages[0].content.filter(
        (item: { type: string }) => item.type === "image_url",
      );
      assert.equal(images.length, 2);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...approved,
                charactersMatchReferences: true,
              }),
            },
          },
        ],
      });
    },
  );
  await reviewImage(art, "artwork", idea);
});

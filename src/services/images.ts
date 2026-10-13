import { loadCharacterReferences } from "./characterReferences.js";
import {
  buildArtworkInstructions,
  REFERENCE_IDENTITY_INSTRUCTIONS,
} from "../memes/imagePrompts.js";
import { textToImage } from "./huggingFace.js";
import { ART_HEIGHT, ART_WIDTH, getImageConfig } from "../config/images.js";

export function buildArtworkPrompt(visualPrompt: string): string {
  if (!visualPrompt.trim()) throw new Error("A visual description is required");
  return buildArtworkInstructions(
    visualPrompt.trim(),
    process.env.HF_ARTWORK_PROMPT,
  );
}

export function buildImageRequest(visualPrompt: string, attempt = 0) {
  const config = getImageConfig();
  const parameters = {
    ...(config.referenceMode && config.model.includes("Kontext")
      ? { aspect_ratio: "4:3" }
      : {}),
    num_inference_steps: config.steps,
    guidance_scale: config.guidance,
    ...(config.seed === undefined
      ? {}
      : { seed: (config.seed + attempt) % 2147483648 }),
    ...(config.provider === "fal-ai"
      ? { image_size: { width: ART_WIDTH, height: ART_HEIGHT } }
      : { width: ART_WIDTH, height: ART_HEIGHT }),
  };
  return {
    model: config.model,
    provider: config.provider,
    inputs:
      buildArtworkPrompt(visualPrompt) +
      (config.referenceMode ? `\n${REFERENCE_IDENTITY_INSTRUCTIONS}` : ""),
    parameters,
  };
}

export async function generateImage(
  visualPrompt: string,
  attempt = 0,
): Promise<Buffer> {
  const referenceSheet = await loadCharacterReferences();
  const request = buildImageRequest(visualPrompt, attempt);
  console.log(`Generating artwork with ${request.model} (${request.provider})`);
  const image: unknown = await textToImage(request, referenceSheet);
  if (image instanceof Blob) return Buffer.from(await image.arrayBuffer());
  if (image instanceof Uint8Array) return Buffer.from(image);
  if (typeof image === "string") {
    const url = new URL(image);
    if (url.protocol !== "https:")
      throw new Error("Generated image URL must use HTTPS");
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok)
      throw new Error(`Failed to download generated image: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("Unsupported image format returned by Hugging Face");
}

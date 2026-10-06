import { InferenceClient } from "@huggingface/inference";
import { getEnv } from "../config/env.js";
import { ART_HEIGHT, ART_WIDTH, getImageConfig } from "../config/images.js";

export function buildArtworkPrompt(visualPrompt: string): string {
  if (!visualPrompt.trim()) throw new Error("A visual description is required");
  return `Create a polished editorial cartoon illustration of this scene:\n${visualPrompt.trim()}\n
Consistent style: clean bold outlines, expressive characters, limited teal and warm orange palette,
soft directional lighting, uncluttered background, clear visual joke, one coherent scene.
Landscape 4:3 composition. Keep the main subject fully visible with breathing room around the edges.
Render artwork only. No text, letters, numbers, captions, speech bubbles, UI labels, logos or watermarks.
Computer displays must use abstract shapes rather than readable text. Do not draw caption panels.`;
}

export function buildImageRequest(visualPrompt: string, attempt = 0) {
  const config = getImageConfig();
  const parameters = {
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
    inputs: buildArtworkPrompt(visualPrompt),
    parameters,
  };
}

export async function generateImage(
  visualPrompt: string,
  attempt = 0,
): Promise<Buffer> {
  const hf = new InferenceClient(getEnv("HF_TOKEN"));
  const request = buildImageRequest(visualPrompt, attempt);
  console.log(`Generating artwork with ${request.model} (${request.provider})`);
  const image: unknown = await hf.textToImage(request);
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

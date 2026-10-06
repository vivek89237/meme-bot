import { InferenceClient } from "@huggingface/inference";
import { getEnv } from "../config/env.js";

export async function generateImage(
  prompt: string,
  model: string = getEnv("HF_IMAGE_MODEL"),
): Promise<Buffer> {
  const hf = new InferenceClient(getEnv("HF_TOKEN"));
  console.log("🎨 Generating image...");

  const image: unknown = await hf.textToImage({
    model,
    inputs: prompt,
    provider: "auto",
  });

  let imageBuffer: Buffer;

  // Hugging Face can return a Blob
  if (typeof image === "object" && image !== null && image instanceof Blob) {
    imageBuffer = Buffer.from(await image.arrayBuffer());
  }
  // Some versions/types may return a URL
  else if (typeof image === "string") {
    const response = await fetch(image);

    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }

    imageBuffer = Buffer.from(await response.arrayBuffer());
  }
  // Handle Uint8Array if returned
  else if (image instanceof Uint8Array) {
    imageBuffer = Buffer.from(image);
  } else {
    throw new Error("Unsupported image format returned by Hugging Face");
  }

  return imageBuffer;
}

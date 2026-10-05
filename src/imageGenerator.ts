import "dotenv/config";
import fs from "node:fs/promises";

import { InferenceClient } from "@huggingface/inference";

function getEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }

  return value;
}

const HF_TOKEN = getEnv("HF_TOKEN");
const HF_IMAGE_MODEL = getEnv("HF_IMAGE_MODEL");

const hf = new InferenceClient(HF_TOKEN);

export async function generateImage(
  prompt: string,
  model: string = HF_IMAGE_MODEL
): Promise<Buffer> {
  console.log("🎨 Generating test image...");

  const image = await hf.textToImage({
    model,
    inputs: prompt,
    provider: "auto",
  });

  let imageBuffer: Buffer;

  // Hugging Face can return a Blob
  if (
    typeof image === "object" &&
    image !== null &&
    (image as any) instanceof Blob
  ) {
    imageBuffer = Buffer.from(
      await (image as Blob).arrayBuffer()
    );
  }
  // Some versions/types may return a URL
  else if (typeof image === "string") {
    const response = await fetch(image);

    if (!response.ok) {
      throw new Error(
        `Failed to download generated image: ${response.status}`
      );
    }

    imageBuffer = Buffer.from(
      await response.arrayBuffer()
    );
  }
  // Handle Uint8Array if returned
  else if ((image as any) instanceof Uint8Array) {
    imageBuffer = Buffer.from(image);
  }
  else {
    throw new Error(
      "Unsupported image format returned by Hugging Face"
    );
  }

  const outputPath = "test-generated-meme.png";

  await fs.writeFile(
    outputPath,
    imageBuffer
  );

  console.log(
    `✅ Image generated!`
  );

  console.log(
    `📁 Saved as ${outputPath}`
  );

  return imageBuffer;
}
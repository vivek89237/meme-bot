import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateImage } from "../services/images.js";
import { validateImageBytes } from "../services/imageQuality.js";
import sharp from "sharp";
import { run } from "./run.js";

run(async () => {
  const prompt = process.argv[2];
  if (!prompt) throw new Error('Usage: npm run image -- "Prompt" [output.png]');
  const output = process.argv[3] || "generated/artwork.png";
  if (!output.toLowerCase().endsWith(".png"))
    throw new Error("Artwork output must use a .png extension");
  const artwork = await generateImage(prompt);
  await validateImageBytes(artwork, "artwork");
  const image = await sharp(artwork).png().toBuffer();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, image);
  console.log(`Saved image to ${output}`);
});

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateImage } from "../services/images.js";
import { run } from "./run.js";

run(async () => {
  const prompt = process.argv[2];
  if (!prompt) throw new Error('Usage: npm run image -- "Prompt" [output.png]');
  const output = process.argv[3] || "generated/meme.png";
  const image = await generateImage(prompt);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, image);
  console.log(`Saved image to ${output}`);
});

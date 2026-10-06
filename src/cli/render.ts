import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { renderMeme } from "../services/renderMeme.js";
import { validateImageBytes } from "../services/imageQuality.js";
import { run } from "./run.js";

run(async () => {
  const [file, topText, bottomText, output = "generated/meme.jpg"] =
    process.argv.slice(2);
  if (!file || !topText || !bottomText || !/\.jpe?g$/iu.test(output)) {
    throw new Error(
      'Usage: npm run render -- artwork.png "Top caption" "Bottom caption" [output.jpg]',
    );
  }
  const artwork = await readFile(file);
  await validateImageBytes(artwork, "artwork");
  const image = await renderMeme(artwork, topText, bottomText);
  await validateImageBytes(image, "final");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, image);
  console.log(
    `Rendered ${output}; review this local preview before publishing (no AI vision check run)`,
  );
});

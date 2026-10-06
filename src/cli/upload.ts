import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { uploadImage } from "../services/storage.js";
import { run } from "./run.js";

run(async () => {
  const file = process.argv[2] || "generated/meme.png";
  const extension = extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(extension))
    throw new Error("Expected a PNG or JPEG image");
  const url = await uploadImage(
    await readFile(file),
    extension === ".png" ? "image/png" : "image/jpeg",
  );
  console.log(url);
});

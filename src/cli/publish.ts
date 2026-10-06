import { getEnv, getInstagramConfig, isServiceRoleKey } from "../config/env.js";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { uploadImage } from "../services/storage.js";
import {
  createInstagramContainer,
  waitForInstagramContainer,
  publishToInstagram,
} from "../services/instagram.js";
import { run } from "./run.js";

run(async () => {
  const file = process.argv[2];
  if (!file)
    throw new Error('Usage: npm run publish -- ./meme.jpg "Your caption"');
  const extension = extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(extension))
    throw new Error("Expected a PNG or JPEG image");
  getInstagramConfig();
  if (!isServiceRoleKey(getEnv("SUPABASE_SERVICE_ROLE_KEY"))) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be a secret key or legacy service-role JWT",
    );
  }
  const caption = process.argv.slice(3).join(" ") || "API test 🚀";
  const imageUrl = await uploadImage(
    await readFile(file),
    extension === ".png" ? "image/png" : "image/jpeg",
  );
  const creationId = await createInstagramContainer(imageUrl, caption);
  await waitForInstagramContainer(creationId);
  const permalink = await publishToInstagram(creationId);
  console.log(permalink || "Published successfully");
});

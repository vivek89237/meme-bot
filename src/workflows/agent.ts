import { COUPLE_HASHTAGS } from "../memes/prompts.js";
import { getEnv, getInstagramConfig } from "../config/env.js";
import { addToPool, hashExists } from "../services/pool.js";
import { createMemeImage } from "./createMeme.js";
import {
  getImageConfig,
  getTemplate,
  getVisionConfig,
} from "../config/images.js";
import { uploadImage } from "../services/storage.js";
import {
  generateIdeas,
  reviewIdeas,
  selectBestIdea,
} from "../services/ideas.js";
import {
  createInstagramContainer,
  waitForInstagramContainer,
  publishToInstagram,
} from "../services/instagram.js";
import type { MemeIdea } from "../memes/types.js";

async function removeDuplicates(ideas: MemeIdea[]): Promise<MemeIdea[]> {
  console.log("\n🔎 Checking for duplicate memes...");

  const unique: MemeIdea[] = [];

  for (const idea of ideas) {
    const exists = await hashExists(idea.hash);

    if (exists) {
      console.log(`❌ Duplicate: ${idea.text}`);
      continue;
    }

    console.log(`✅ New idea: ${idea.text}`);

    unique.push(idea);
  }

  return unique;
}
export async function runAgent(): Promise<void> {
  // Validate mandatory configuration before making paid inference requests.
  const { host: GRAPH_API_HOST } = getInstagramConfig();
  for (const name of [
    "HF_TOKEN",
    "HF_MODEL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ])
    getEnv(name);
  getImageConfig();
  getVisionConfig();
  getTemplate();
  console.log("\n========================================");

  console.log("🤖 INSTAGRAM AI MEME AGENT");

  console.log("========================================");

  console.log(`📡 Instagram API: ${GRAPH_API_HOST}`);

  // 1. Generate ideas
  const ideas = await generateIdeas();

  console.log(`\nGenerated ${ideas.length} ideas.`);

  if (ideas.length === 0) {
    throw new Error("No meme ideas were generated");
  }

  // 2. Remove duplicates
  const uniqueIdeas = await removeDuplicates(ideas);

  if (uniqueIdeas.length === 0) {
    throw new Error("All generated memes were duplicates");
  }

  // 3. Review
  const reviewed = await reviewIdeas(uniqueIdeas);

  // 4. Select
  const selected = selectBestIdea(reviewed);

  if (!selected) {
    throw new Error("No suitable meme was selected");
  }

  // 5. Generate image
  const imageBuffer = await createMemeImage(selected);

  // 6. Upload
  const imageUrl = await uploadImage(imageBuffer, "image/jpeg");

  // 7. Caption
  const caption = `${selected.text}\n\n` + COUPLE_HASHTAGS;

  // 8. Save to meme pool
  console.log("\n💾 Saving meme to pool...");

  await addToPool({
    image_url: imageUrl,
    source_url: null,
    caption,
    status: "approved",
    posted_at: null,
    ai_score: selected.score,
    ai_reason: selected.reason,
    category: selected.category,
    hash: selected.hash,
  });

  console.log("✅ Meme saved to meme_pool");

  // 9. Instagram container
  const creationId = await createInstagramContainer(imageUrl, caption);

  // 10. Wait
  await waitForInstagramContainer(creationId);

  // 11. Publish
  const permalink = await publishToInstagram(creationId);

  console.log("\n========================================");

  console.log("🎉 MEME AGENT COMPLETED");

  console.log("========================================");

  if (permalink) {
    console.log(`📱 Instagram: ${permalink}`);
  }
}

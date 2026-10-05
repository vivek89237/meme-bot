import "dotenv/config";

import { InferenceClient } from "@huggingface/inference";
import { createClient } from "@supabase/supabase-js";

import { addToPool, hashExists } from "./pool.js";
import { generateImage } from "./imageGenerator.js";

function getEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }

  return value;
}

// ============================================================
// ENVIRONMENT
// ============================================================

const HF_TOKEN = getEnv("HF_TOKEN");
const HF_MODEL = getEnv("HF_MODEL");
const HF_IMAGE_MODEL = getEnv("HF_IMAGE_MODEL");

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv(
  "SUPABASE_SERVICE_ROLE_KEY"
);
const SUPABASE_BUCKET =
  process.env.SUPABASE_BUCKET?.trim() || "Meme";

const INSTAGRAM_USER_ID = getEnv("INSTAGRAM_USER_ID");

// IMPORTANT:
// Use the same token handling as the working publish.ts
const INSTAGRAM_ACCESS_TOKEN = getEnv(
  "INSTAGRAM_ACCESS_TOKEN"
);

const INSTAGRAM_TOKEN = INSTAGRAM_ACCESS_TOKEN.trim();

const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION?.trim() || "v24.0";

// IG tokens use graph.instagram.com.
// Facebook tokens use graph.facebook.com.
const GRAPH_API_HOST = INSTAGRAM_TOKEN.startsWith("IG")
  ? "https://graph.instagram.com"
  : "https://graph.facebook.com";

const graphUrl = (path: string) =>
  `${GRAPH_API_HOST}/${GRAPH_API_VERSION}/${path}`;

// ============================================================
// CLIENTS
// ============================================================

const hf = new InferenceClient(HF_TOKEN);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// ============================================================
// TYPES
// ============================================================

interface MemeIdea {
  text: string;
  category: string;
  hash: string;
}

interface ReviewedIdea extends MemeIdea {
  score: number;
  reason: string;
}

// ============================================================
// HELPERS
// ============================================================

function cleanJson(text: string): string {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function createHash(text: string): string {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(16);
}

// ============================================================
// STEP 1 — GENERATE MEME IDEAS
// ============================================================

async function generateIdeas(): Promise<MemeIdea[]> {
  console.log("\n🧠 Generating meme ideas...");

  const prompt = `
Generate 5 original programming/developer meme ideas.

The memes should be:
- relatable to software developers
- funny
- suitable for Instagram
- short and easy to understand
- based on programming, bugs, Git, AI, debugging, meetings,
  deployment, coding, databases or developer life

Avoid:
- offensive jokes
- politics
- sexual content
- copyrighted characters
- repeating common meme templates

Return ONLY valid JSON in this format:

[
  {
    "text": "meme text",
    "category": "category"
  }
]
`;

  const response = await hf.chatCompletion({
    model: HF_MODEL,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 1200,
  });

  const raw =
    response.choices?.[0]?.message?.content ?? "";

  const parsed = JSON.parse(cleanJson(raw));

  if (!Array.isArray(parsed)) {
    throw new Error("AI did not return an array of ideas");
  }

  return parsed
    .filter(
      (item) =>
        item &&
        typeof item.text === "string" &&
        typeof item.category === "string"
    )
    .map((item) => ({
      text: item.text.trim(),
      category: item.category.trim(),
      hash: createHash(item.text.trim().toLowerCase()),
    }))
    .slice(0, 5);
}

// ============================================================
// STEP 2 — REMOVE DUPLICATES
// ============================================================

async function removeDuplicates(
  ideas: MemeIdea[]
): Promise<MemeIdea[]> {
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

// ============================================================
// STEP 3 — AI REVIEW
// ============================================================

async function reviewIdeas(
  ideas: MemeIdea[]
): Promise<ReviewedIdea[]> {
  console.log("\n🤖 Reviewing meme ideas...");

  const reviewed: ReviewedIdea[] = [];

  for (const idea of ideas) {
    const prompt = `
Rate this developer meme idea from 0 to 100.

Meme:
"${idea.text}"

Evaluate:
- humor
- relatability
- originality
- Instagram potential
- clarity

Return ONLY valid JSON:

{
  "score": 0,
  "reason": "short explanation"
}
`;

    try {
      const response = await hf.chatCompletion({
        model: HF_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 300,
      });

      const raw =
        response.choices?.[0]?.message?.content ?? "";

      const result = JSON.parse(cleanJson(raw));

      const score = Number(result.score) || 0;

      reviewed.push({
        ...idea,
        score,
        reason: String(result.reason || ""),
      });

      console.log(
        `⭐ ${score}/100 — ${idea.text}`
      );
    } catch (error) {
      console.log(
        `⚠️ Review failed for: ${idea.text}`
      );

      reviewed.push({
        ...idea,
        score: 0,
        reason: "AI review failed",
      });
    }
  }

  return reviewed;
}

// ============================================================
// STEP 4 — SELECT BEST IDEA
// ============================================================

function selectBestIdea(
  ideas: ReviewedIdea[]
): ReviewedIdea | null {
  if (ideas.length === 0) {
    return null;
  }

  const sorted = [...ideas].sort(
    (a, b) => b.score - a.score
  );

  const best = sorted[0];

  if (!best || best.score < 70) {
    console.log(
      "\n❌ No meme reached the minimum score of 70."
    );

    return null;
  }

  console.log(
    `\n🏆 Selected: ${best.text}`
  );

  console.log(
    `⭐ Score: ${best.score}/100`
  );

  return best;
}

// ============================================================
// STEP 5 — GENERATE IMAGE
// ============================================================

async function generateMemeImage(
  idea: ReviewedIdea
): Promise<Buffer> {
  console.log("\n🎨 Generating meme image...");

  const imagePrompt = `
Create a visually appealing Instagram meme image.

Meme text:
"${idea.text}"

Category:
${idea.category}

Style:
- modern developer meme
- clean composition
- funny
- highly readable
- vertical Instagram format
- no watermark
- no logos
- no unnecessary text
`;

  await generateImage(
    imagePrompt,
    HF_IMAGE_MODEL
  );

  const fileName = "test-generated-meme.png";

  const fs = await import("node:fs/promises");

  try {
    const imageBuffer = await fs.readFile(fileName);

    console.log(
      `✅ Loaded generated image: ${fileName}`
    );

    return imageBuffer;
  } catch (error) {
    throw new Error(
      `Generated image was not found at ${fileName}`
    );
  }
}
// ============================================================
// STEP 6 — UPLOAD IMAGE TO SUPABASE
// ============================================================

async function uploadImage(
  imageBuffer: Buffer
): Promise<string> {
  console.log("\n☁️ Uploading image to Supabase...");

  const fileName =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.png`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(fileName, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Supabase upload failed: ${error.message}`
    );
  }

  console.log("✅ Image uploaded");

  // IMPORTANT:
  // The Meme bucket is private.
  // Instagram needs a signed URL that it can fetch directly.
  const { data: signed, error: signError } =
    await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(
        fileName,
        60 * 60 * 2
      );

  if (
    signError ||
    !signed?.signedUrl
  ) {
    throw new Error(
      `Could not create signed URL: ${
        signError?.message ??
        "unknown error"
      }`
    );
  }

  console.log(
    "✅ Signed URL generated for Instagram"
  );

  return signed.signedUrl;
}

// ============================================================
// STEP 7 — CREATE INSTAGRAM MEDIA CONTAINER
// ============================================================

async function createInstagramContainer(
  imageUrl: string,
  caption: string
): Promise<string> {
  console.log(
    "\n📸 Creating Instagram media container..."
  );

  console.log(
    `🔐 Instagram API host: ${GRAPH_API_HOST}`
  );

  const response = await fetch(
    graphUrl(`${INSTAGRAM_USER_ID}/media`),
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: INSTAGRAM_TOKEN,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(
      `Instagram media creation failed: ${JSON.stringify(
        result
      )}`
    );
  }

  if (!result.id) {
    throw new Error(
      "Instagram did not return a creation ID"
    );
  }

  console.log(
    `✅ Creation ID: ${result.id}`
  );

  return result.id;
}

// ============================================================
// STEP 8 — WAIT FOR INSTAGRAM CONTAINER
// ============================================================

async function waitForInstagramContainer(
  creationId: string
): Promise<void> {
  console.log(
    "\n⏳ Waiting for Instagram to process image..."
  );

  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) =>
      setTimeout(resolve, 5000)
    );

    const response = await fetch(
      graphUrl(`${creationId}?fields=status_code&access_token=${encodeURIComponent(INSTAGRAM_TOKEN)}`)
    );

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(
        `Instagram status check failed: ${JSON.stringify(
          result
        )}`
      );
    }

    console.log(
      `⏳ Attempt ${attempt}/${maxAttempts}: ${result.status_code}`
    );

    if (result.status_code === "FINISHED") {
      console.log(
        "✅ Instagram container ready"
      );

      return;
    }

    if (
      result.status_code === "ERROR" ||
      result.status_code === "EXPIRED"
    ) {
      throw new Error(
        `Instagram container failed: ${JSON.stringify(
          result
        )}`
      );
    }
  }

  throw new Error(
    "Instagram container processing timed out"
  );
}

// ============================================================
// STEP 9 — PUBLISH TO INSTAGRAM
// ============================================================

async function publishToInstagram(
  creationId: string
): Promise<string | null> {
  console.log(
    "\n🚀 Publishing to Instagram..."
  );

  const response = await fetch(
    graphUrl(
      `${INSTAGRAM_USER_ID}/media_publish`
    ),
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: INSTAGRAM_TOKEN,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(
      `Instagram publishing failed: ${JSON.stringify(
        result
      )}`
    );
  }

  console.log(
    `✅ Instagram published: ${result.id}`
  );

  // Try to retrieve permalink
  try {
    const permalinkResponse = await fetch(
      graphUrl(
        `${result.id}?fields=permalink&access_token=${encodeURIComponent(
          INSTAGRAM_TOKEN
        )}`
      )
    );

    const permalinkResult =
      await permalinkResponse.json();

    if (permalinkResult.permalink) {
      console.log(
        `🔗 ${permalinkResult.permalink}`
      );

      return permalinkResult.permalink;
    }
  } catch {
    // Publishing already succeeded.
  }

  return null;
}

// ============================================================
// STEP 10 — MAIN AGENT
// ============================================================

async function runAgent(): Promise<void> {
  console.log(
    "\n========================================"
  );

  console.log(
    "🤖 INSTAGRAM AI MEME AGENT"
  );

  console.log(
    "========================================"
  );

  console.log(
    `📡 Instagram API: ${GRAPH_API_HOST}`
  );

  // 1. Generate ideas
  const ideas = await generateIdeas();

  console.log(
    `\nGenerated ${ideas.length} ideas.`
  );

  if (ideas.length === 0) {
    throw new Error(
      "No meme ideas were generated"
    );
  }

  // 2. Remove duplicates
  const uniqueIdeas =
    await removeDuplicates(ideas);

  if (uniqueIdeas.length === 0) {
    throw new Error(
      "All generated memes were duplicates"
    );
  }

  // 3. Review
  const reviewed =
    await reviewIdeas(uniqueIdeas);

  // 4. Select
  const selected =
    selectBestIdea(reviewed);

  if (!selected) {
    throw new Error(
      "No suitable meme was selected"
    );
  }

  // 5. Generate image
  const imageBuffer =
    await generateMemeImage(selected);

  // 6. Upload
  const imageUrl =
    await uploadImage(imageBuffer);

  // 7. Caption
  const caption =
    `${selected.text}\n\n` +
    `#memes #programming #developer #coding #relatable`;

  // 8. Save to meme pool
  console.log(
    "\n💾 Saving meme to pool..."
  );

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

  console.log(
    "✅ Meme saved to meme_pool"
  );

  // 9. Instagram container
  const creationId =
    await createInstagramContainer(
      imageUrl,
      caption
    );

  // 10. Wait
  await waitForInstagramContainer(
    creationId
  );

  // 11. Publish
  const permalink =
    await publishToInstagram(
      creationId
    );

  console.log(
    "\n========================================"
  );

  console.log(
    "🎉 MEME AGENT COMPLETED"
  );

  console.log(
    "========================================"
  );

  if (permalink) {
    console.log(
      `📱 Instagram: ${permalink}`
    );
  }
}

// ============================================================
// START
// ============================================================

runAgent().catch((error) => {
  console.error(
    "\n❌ AGENT FAILED\n"
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
});
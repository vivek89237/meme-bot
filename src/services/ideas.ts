import { InferenceClient } from "@huggingface/inference";
import { getEnv } from "../config/env.js";
import { cleanJson, createHash } from "../utils/text.js";
import type { MemeIdea, ReviewedIdea } from "../memes/types.js";

export async function generateIdeas(): Promise<MemeIdea[]> {
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

  const response = await new InferenceClient(getEnv("HF_TOKEN")).chatCompletion(
    {
      model: getEnv("HF_MODEL"),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1200,
    },
  );

  const raw = response.choices?.[0]?.message?.content ?? "";

  const parsed = JSON.parse(cleanJson(raw));

  if (!Array.isArray(parsed)) {
    throw new Error("AI did not return an array of ideas");
  }

  return parsed
    .filter(
      (item) =>
        item &&
        typeof item.text === "string" &&
        typeof item.category === "string",
    )
    .map((item) => ({
      text: item.text.trim(),
      category: item.category.trim(),
      hash: createHash(item.text.trim().toLowerCase()),
    }))
    .slice(0, 5);
}
export async function reviewIdeas(ideas: MemeIdea[]): Promise<ReviewedIdea[]> {
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
      const response = await new InferenceClient(
        getEnv("HF_TOKEN"),
      ).chatCompletion({
        model: getEnv("HF_MODEL"),
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 300,
      });

      const raw = response.choices?.[0]?.message?.content ?? "";

      const result = JSON.parse(cleanJson(raw));

      const score = Number(result.score) || 0;

      reviewed.push({
        ...idea,
        score,
        reason: String(result.reason || ""),
      });

      console.log(`⭐ ${score}/100 — ${idea.text}`);
    } catch (error) {
      console.log(`⚠️ Review failed for: ${idea.text}`);

      reviewed.push({
        ...idea,
        score: 0,
        reason: "AI review failed",
      });
    }
  }

  return reviewed;
}

export function selectBestIdea(ideas: ReviewedIdea[]): ReviewedIdea | null {
  if (ideas.length === 0) {
    return null;
  }

  const sorted = [...ideas].sort((a, b) => b.score - a.score);

  const best = sorted[0];

  if (!best || best.score < 70) {
    console.log("\n❌ No meme reached the minimum score of 70.");

    return null;
  }

  console.log(`\n🏆 Selected: ${best.text}`);

  console.log(`⭐ Score: ${best.score}/100`);

  return best;
}

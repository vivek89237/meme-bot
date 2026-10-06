import { COUPLE_HASHTAGS } from "./prompts.js";
import { createHash } from "../utils/text.js";

export interface GeneratedMeme {
  caption: string;
  category: string;
  hash: string;
}

const categories: string[] = [
  "cuddles",
  "snacks",
  "playful-teasing",
  "missing-you",
  "sleepy-couple",
  "relatable",
];

const ideas: string[] = [
  "When one hug turns into an afternoon of cuddles",
  "When your snacks become our snacks",
  "When you say you are not sleepy, then fall asleep on me",
  "When I steal your blanket but offer a hug in return",
  "When you pretend to be annoyed but move closer anyway",
];

export async function generateMeme(): Promise<GeneratedMeme> {
  const category =
    categories[Math.floor(Math.random() * categories.length)] ?? "relatable";

  const idea =
    ideas[Math.floor(Math.random() * ideas.length)] ??
    "When one hug turns into an afternoon of cuddles";

  const caption = `${idea} 😂

${COUPLE_HASHTAGS}`;

  const hash = createHash(caption);

  return {
    caption,
    category,
    hash,
  };
}

import { createHash } from "../utils/text.js";

export interface GeneratedMeme {
  caption: string;
  category: string;
  hash: string;
}

const categories: string[] = [
  "programming",
  "office",
  "developer",
  "college",
  "work",
  "relatable",
];

const ideas: string[] = [
  "When the code works on the first try",
  "When production works but localhost doesn't",
  "When your manager says it is a small change",
  "When you finally fix a bug and create three more",
  "When the meeting could have been an email",
];

export async function generateMeme(): Promise<GeneratedMeme> {
  const category =
    categories[Math.floor(Math.random() * categories.length)] ?? "relatable";

  const idea =
    ideas[Math.floor(Math.random() * ideas.length)] ??
    "When the code works on the first try";

  const caption = `${idea} 😂

#memes #programming #developer #coding #relatable`;

  const hash = createHash(caption);

  return {
    caption,
    category,
    hash,
  };
}

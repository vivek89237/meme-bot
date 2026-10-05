import dotenv from "dotenv";

dotenv.config();

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

function generateHash(text: string): string {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(16);
}

export async function generateMeme(): Promise<GeneratedMeme> {
  const category =
    categories[
      Math.floor(Math.random() * categories.length)
    ] ?? "relatable";

  const idea =
    ideas[
      Math.floor(Math.random() * ideas.length)
    ] ?? "When the code works on the first try";

  const caption = `${idea} 😂

#memes #programming #developer #coding #relatable`;

  const hash = generateHash(caption);

  return {
    caption,
    category,
    hash,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const meme = await generateMeme();

  console.log("Generated meme:");
  console.log(meme);
}
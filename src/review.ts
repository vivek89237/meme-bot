import dotenv from "dotenv";

dotenv.config();

export interface MemeReview {
  ai_score: number;
  ai_reason: string;
  status: "approved" | "rejected";
}

export async function reviewMeme(
  caption: string
): Promise<MemeReview> {
  if (!caption || caption.trim().length === 0) {
    return {
      ai_score: 0,
      ai_reason: "Caption is empty",
      status: "rejected",
    };
  }

  if (caption.length < 10) {
    return {
      ai_score: 30,
      ai_reason: "Caption is too short",
      status: "rejected",
    };
  }

  return {
    ai_score: 80,
    ai_reason: "Basic quality check passed",
    status: "approved",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await reviewMeme(
    "When production works but localhost doesn't 😂"
  );

  console.log(result);
}
export const MAX_CAPTION_CHARACTERS = 90;
export const MAX_CAPTION_WORDS = 14;

/** Reject bad captions instead of silently truncating or changing approved wording. */
export function validateCaption(value: unknown): string {
  if (typeof value !== "string") throw new Error("Caption must be a string");
  const text = value.trim().replace(/\s+/gu, " ");
  if (!text || text.length > MAX_CAPTION_CHARACTERS) {
    throw new Error(
      `Caption must contain 1–${MAX_CAPTION_CHARACTERS} characters`,
    );
  }
  if (text.split(" ").length > MAX_CAPTION_WORDS) {
    throw new Error(`Caption must contain at most ${MAX_CAPTION_WORDS} words`);
  }
  if (/(^|\s)([\p{L}\p{N}]+)[\p{P}]*\s+\2(?=\s|[\p{P}]|$)/iu.test(text)) {
    throw new Error("Caption contains consecutive repeated words");
  }
  if (/[\p{Cc}\p{Cf}]/u.test(text))
    throw new Error("Caption contains control characters");
  return text;
}

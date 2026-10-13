import {
  ARTWORK_REVIEW_CHECKS,
  buildImageReviewPrompt,
} from "../memes/imagePrompts.js";
import { loadCharacterReferences } from "./characterReferences.js";
import { usesCharacterReferences } from "../config/characterReferences.js";
import sharp from "sharp";
import { chatCompletion } from "./huggingFace.js";
import {
  ART_HEIGHT,
  ART_WIDTH,
  ART_SIZE_TOLERANCE,
  getVisionConfig,
} from "../config/images.js";
import { MEME_HEIGHT, MEME_WIDTH } from "./renderMeme.js";
import { cleanJson } from "../utils/text.js";
import { validateCaption } from "../memes/caption.js";
import type { MemeIdea } from "../memes/types.js";

export class ImageQualityError extends Error {}
export type ImageStage = "artwork" | "final";

export async function validateImageBytes(
  image: Buffer,
  stage: ImageStage,
): Promise<void> {
  try {
    const input = sharp(image, { limitInputPixels: 20_000_000 });
    const metadata = await input.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1 ||
      !["png", "jpeg", "webp"].includes(metadata.format ?? "")
    ) {
      throw new ImageQualityError(
        "Expected a single-frame PNG, JPEG or WebP image",
      );
    }
    if (stage === "artwork") {
      // Providers may round requested dimensions to their native pixel grid.
      // Allow at most 32 pixels per edge; do not upscale low-resolution inputs.
      if (
        metadata.width < ART_WIDTH - ART_SIZE_TOLERANCE ||
        metadata.height < ART_HEIGHT - ART_SIZE_TOLERANCE
      )
        throw new ImageQualityError(
          `Artwork must be at least ${ART_WIDTH - ART_SIZE_TOLERANCE}×${ART_HEIGHT - ART_SIZE_TOLERANCE} (target ${ART_WIDTH}×${ART_HEIGHT}); received ${metadata.width}×${metadata.height}`,
        );
      const stats = await input.stats();
      if (stats.channels.slice(0, 3).every((channel) => channel.stdev < 8))
        throw new ImageQualityError(
          "Artwork is blank or has too little visual detail",
        );
    } else if (
      metadata.width !== MEME_WIDTH ||
      metadata.height !== MEME_HEIGHT ||
      metadata.format !== "jpeg"
    ) {
      throw new ImageQualityError(
        `Final meme must be a ${MEME_WIDTH}×${MEME_HEIGHT} JPEG`,
      );
    } else {
      await input.raw().toBuffer(); // Decode every pixel; metadata alone cannot detect truncated files.
    }
  } catch (error) {
    if (error instanceof ImageQualityError) throw error;
    throw new ImageQualityError("Image could not be fully decoded");
  }
}

export function parseImageReview(
  raw: string,
  stage: ImageStage,
  idea: Pick<MemeIdea, "topText" | "bottomText">,
): void {
  const parsed: unknown = JSON.parse(cleanJson(raw));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Invalid image review response; publication blocked");
  const result = parsed as Record<string, unknown>;
  if (
    !result ||
    typeof result.score !== "number" ||
    !Number.isFinite(result.score) ||
    result.score < 0 ||
    result.score > 100 ||
    typeof result.reason !== "string" ||
    Object.keys(ARTWORK_REVIEW_CHECKS).some(
      (field) => typeof result[field] !== "boolean",
    )
  ) {
    throw new Error("Invalid image review response; publication blocked");
  }
  if (usesCharacterReferences()) {
    if (typeof result.charactersMatchReferences !== "boolean")
      throw new Error(
        "Missing character-reference comparison; publication blocked",
      );
    if (!result.charactersMatchReferences)
      throw new ImageQualityError(
        "Character appearance differs from the approved references",
      );
  }
  const failedChecks = Object.entries(ARTWORK_REVIEW_CHECKS)
    .filter(([field, expected]) => result[field] !== expected)
    .map(([field]) => field);
  if (result.score < 80) failedChecks.unshift("score");
  if (failedChecks.length)
    throw new ImageQualityError(
      `Image failed ${stage} quality review: ${failedChecks.join(", ")}`,
    );
  if (stage === "final") {
    if (
      typeof result.topTextRead !== "string" ||
      typeof result.bottomTextRead !== "string" ||
      typeof result.textClipped !== "boolean"
    ) {
      throw new Error("Missing final-image text review; publication blocked");
    }
    // Ignore line wrapping, but preserve spelling, punctuation and letter case.
    const normalize = (text: string) => text.trim().replace(/\s+/gu, " ");
    if (
      normalize(result.topTextRead) !== validateCaption(idea.topText) ||
      normalize(result.bottomTextRead) !== validateCaption(idea.bottomText) ||
      result.textClipped !== false
    ) {
      throw new ImageQualityError(
        "Rendered caption did not match the approved text or was clipped",
      );
    }
  }
}

export async function reviewImage(
  image: Buffer,
  stage: ImageStage,
  idea: MemeIdea,
): Promise<void> {
  await validateImageBytes(image, stage);
  const config = getVisionConfig();
  const referenceSheet = await loadCharacterReferences();
  const metadata = await sharp(image).metadata();
  const mime =
    metadata.format === "jpeg"
      ? "image/jpeg"
      : metadata.format === "webp"
        ? "image/webp"
        : "image/png";
  const response = await chatCompletion({
    ...config,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildImageReviewPrompt(
              stage,
              idea.visualPrompt,
              Boolean(referenceSheet),
            ),
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${image.toString("base64")}`,
            },
          },
          ...(referenceSheet
            ? [
                {
                  type: "image_url" as const,
                  image_url: {
                    url: `data:image/png;base64,${referenceSheet.toString("base64")}`,
                  },
                },
              ]
            : []),
        ],
      },
    ],
    temperature: 0,
    max_tokens: 600,
  });
  parseImageReview(response.choices[0]?.message.content ?? "", stage, idea);
}

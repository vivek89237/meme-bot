import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

export function getReferencePaths(): string[] {
  const raw = process.env.HF_CHARACTER_REFERENCES?.trim();
  if (!raw) return [];
  let paths: unknown;
  try {
    paths = JSON.parse(raw);
  } catch {
    throw new Error(
      "HF_CHARACTER_REFERENCES must be a JSON array of local image paths",
    );
  }
  if (
    !Array.isArray(paths) ||
    paths.length < 1 ||
    paths.length > 4 ||
    paths.some((path) => typeof path !== "string" || !path.trim())
  ) {
    throw new Error(
      "HF_CHARACTER_REFERENCES must contain 1–4 nonempty image paths",
    );
  }
  return paths.map((path: string) => resolve(path));
}

export function usesCharacterReferences(): boolean {
  const mode = process.env.HF_IMAGE_MODE?.trim();
  if (mode && mode !== "text" && mode !== "reference")
    throw new Error("HF_IMAGE_MODE must be text or reference");
  return mode ? mode === "reference" : getReferencePaths().length > 0;
}

/** The same lossless character sheet conditions generation and vision comparison. */
export async function loadCharacterReferences(): Promise<Buffer | undefined> {
  if (!usesCharacterReferences()) return undefined;
  const paths = getReferencePaths();
  if (!paths.length)
    throw new Error(
      "Reference mode requires HF_CHARACTER_REFERENCES; add your approved character images",
    );
  const tiles = await Promise.all(
    paths.map(async (path) => {
      let bytes: Buffer;
      try {
        bytes = await readFile(path);
      } catch {
        throw new Error(
          "Cannot read a character reference image; check HF_CHARACTER_REFERENCES paths",
        );
      }
      if (bytes.length > 5_000_000)
        throw new Error("Each character reference must be at most 5 MB");
      try {
        const input = sharp(bytes, { limitInputPixels: 10_000_000 });
        const metadata = await input.metadata();
        if (
          !["png", "jpeg", "webp"].includes(metadata.format ?? "") ||
          (metadata.pages ?? 1) !== 1 ||
          !metadata.width ||
          !metadata.height ||
          metadata.width < 128 ||
          metadata.height < 128
        ) {
          throw new Error("invalid");
        }
        return await input
          .rotate()
          .flatten({ background: "white" })
          .resize(512, 512, { fit: "contain", background: "white" })
          .png()
          .toBuffer();
      } catch {
        throw new Error(
          "Character references must be readable, single-frame PNG/JPEG/WebP images of at least 128×128 pixels",
        );
      }
    }),
  );
  // A single approved character sheet retains its full composition and resolution.
  if (paths.length === 1) {
    const bytes = await readFile(paths[0]!);
    return sharp(bytes, { limitInputPixels: 10_000_000 })
      .rotate()
      .flatten({ background: "white" })
      .resize({
        width: 1536,
        height: 1536,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  }
  return sharp({
    create: {
      width: 512 * tiles.length,
      height: 512,
      channels: 3,
      background: "white",
    },
  })
    .composite(
      tiles.map((input, index) => ({ input, left: index * 512, top: 0 })),
    )
    .png()
    .toBuffer();
}

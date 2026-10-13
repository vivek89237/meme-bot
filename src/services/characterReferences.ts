import { readFile } from "node:fs/promises";
import {
  getReferencePaths,
  usesCharacterReferences,
} from "../config/characterReferences.js";
import { ART_WIDTH, ART_HEIGHT } from "../config/images.js";
import sharp from "sharp";

async function loadReferenceTile(
  path: string,
  width: number,
  height: number,
): Promise<Buffer> {
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
      .resize(width, height, { fit: "contain", background: "white" })
      .png()
      .toBuffer();
  } catch {
    throw new Error(
      "Character references must be readable, single-frame PNG/JPEG/WebP images of at least 128×128 pixels",
    );
  }
}

/** A padded 4:3 sheet conditions generation and vision comparison without cropping. */
export async function loadCharacterReferences(): Promise<Buffer | undefined> {
  if (!usesCharacterReferences()) return undefined;
  const paths = getReferencePaths();
  if (!paths.length)
    throw new Error(
      "Reference mode requires HF_CHARACTER_REFERENCES; add your approved character images",
    );
  const columns = paths.length === 1 ? 1 : 2;
  const rows = Math.ceil(paths.length / columns);
  const tileWidth = ART_WIDTH / columns;
  const tileHeight = ART_HEIGHT / rows;
  const tiles = await Promise.all(
    paths.map((path) => loadReferenceTile(path, tileWidth, tileHeight)),
  );
  return sharp({
    create: {
      width: ART_WIDTH,
      height: ART_HEIGHT,
      channels: 3,
      background: "white",
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight,
      })),
    )
    .png()
    .toBuffer();
}

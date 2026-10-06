import { fileURLToPath } from "node:url";
import { openSync, type Font } from "fontkit";
import sharp from "sharp";
import { getTemplate } from "../config/images.js";
import { validateCaption } from "../memes/caption.js";

export const MEME_WIDTH = 1080;
export const MEME_HEIGHT = 1350;
export const PANEL_HEIGHT = 270;
const PADDING = 48;
const MAX_LINES = 3;
const MIN_FONT_SIZE = 48;
const MAX_FONT_SIZE = 64;
const fontPath = fileURLToPath(
  new URL("../../assets/fonts/DejaVuSans-Bold.ttf", import.meta.url),
);
let loadedFont: Font | undefined;
function getFont(): Font {
  if (!loadedFont) {
    const loaded = openSync(fontPath);
    if (!("layout" in loaded))
      throw new Error("Expected a standalone TTF font");
    loadedFont = loaded;
  }
  return loadedFont;
}

function measure(text: string, size: number) {
  const font = getFont();
  const run = font.layout(text);
  let cursor = 0;
  let left = 0;
  let right = 0;
  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index]!;
    if (glyph.path.commands.length) {
      left = Math.min(left, cursor + position.xOffset + glyph.bbox.minX);
      right = Math.max(right, cursor + position.xOffset + glyph.bbox.maxX);
    }
    cursor += position.xAdvance;
  });
  right = Math.max(right, cursor);
  return {
    width: ((right - left) * size) / font.unitsPerEm,
    left: (left * size) / font.unitsPerEm,
    run,
  };
}

export interface CaptionLayout {
  text: string;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  textHeight: number;
}

export function layoutCaption(caption: string): CaptionLayout {
  const text = validateCaption(caption);
  const font = getFont();
  for (const character of text) {
    if (!font.hasGlyphForCodePoint(character.codePointAt(0)!)) {
      throw new Error(
        `Caption contains a character unsupported by the bundled font`,
      );
    }
  }
  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= 2) {
    const lines: string[] = [];
    let current = "";
    let fits = true;
    for (const word of text.split(" ")) {
      if (measure(word, fontSize).width > MEME_WIDTH - 2 * PADDING) {
        fits = false;
        break;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (
        current &&
        measure(candidate, fontSize).width > MEME_WIDTH - 2 * PADDING
      ) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    const lineHeight = fontSize * 1.2;
    const textHeight =
      ((font.ascent - font.descent) / font.unitsPerEm) * fontSize +
      (lines.length - 1) * lineHeight;
    if (
      fits &&
      lines.length <= MAX_LINES &&
      textHeight <= PANEL_HEIGHT - 2 * 36
    ) {
      return { text, lines, fontSize, lineHeight, textHeight };
    }
  }
  throw new Error(
    "Caption does not fit the template at a readable font size; shorten it",
  );
}

function drawCaption(layout: CaptionLayout, panelY: number): string {
  const font = getFont();
  const scale = layout.fontSize / font.unitsPerEm;
  const baseline =
    panelY + (PANEL_HEIGHT - layout.textHeight) / 2 + font.ascent * scale;
  return layout.lines
    .map((line, lineIndex) => {
      const { width, left, run } = measure(line, layout.fontSize);
      const x = (MEME_WIDTH - width) / 2 - left;
      const y = baseline + lineIndex * layout.lineHeight;
      let cursor = 0;
      // Vector glyph paths guarantee the same font and exact lettering on every machine.
      const paths = run.glyphs
        .map((glyph, index) => {
          const position = run.positions[index]!;
          const path = `<path d="${glyph.path.toSVG()}" transform="translate(${cursor + position.xOffset} ${position.yOffset})"/>`;
          cursor += position.xAdvance;
          return path;
        })
        .join("");
      return `<g transform="translate(${x} ${y}) scale(${scale} ${-scale})">${paths}</g>`;
    })
    .join("");
}

export async function renderMeme(
  artwork: Buffer,
  topText: string,
  bottomText: string,
): Promise<Buffer> {
  const top = layoutCaption(topText);
  const bottom = layoutCaption(bottomText);
  const template = getTemplate();
  const background = template === "light" ? "#ffffff" : "#111827";
  const foreground = template === "light" ? "#111827" : "#ffffff";
  const artHeight = MEME_HEIGHT - 2 * PANEL_HEIGHT;
  const image = await sharp(artwork, { limitInputPixels: 20_000_000 })
    .rotate()
    .flatten({ background })
    .resize(MEME_WIDTH, artHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const overlay =
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${MEME_WIDTH}" height="${MEME_HEIGHT}" viewBox="0 0 ${MEME_WIDTH} ${MEME_HEIGHT}">
  <g fill="${foreground}">${drawCaption(top, 0)}${drawCaption(bottom, MEME_HEIGHT - PANEL_HEIGHT)}</g></svg>`);
  return sharp({
    create: { width: MEME_WIDTH, height: MEME_HEIGHT, channels: 3, background },
  })
    .composite([
      { input: image, top: PANEL_HEIGHT, left: 0 },
      { input: overlay, top: 0, left: 0 },
    ])
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

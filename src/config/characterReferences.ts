import { resolve } from "node:path";

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

import { getEnv } from "./env.js";
import {
  INFERENCE_PROVIDERS,
  type InferenceProvider,
} from "@huggingface/inference";

export const ART_WIDTH = 1024;
export const ART_HEIGHT = 768;

function numberSetting(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  integer = false,
): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${name} must be ${integer ? "an integer" : "a number"} between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

export function getImageConfig() {
  const provider = process.env.HF_IMAGE_PROVIDER?.trim() || "fal-ai";
  // These adapters support the explicit size/steps/guidance profile below.
  if (!["together", "fal-ai", "hf-inference"].includes(provider)) {
    throw new Error(
      "HF_IMAGE_PROVIDER must be together, fal-ai or hf-inference; auto routing is disabled",
    );
  }
  const seed = process.env.HF_IMAGE_SEED?.trim();
  return {
    model: process.env.HF_IMAGE_MODEL?.trim() || "black-forest-labs/FLUX.1-dev",
    provider: provider as InferenceProvider,
    steps: numberSetting("HF_IMAGE_STEPS", 28, 10, 60, true),
    guidance: numberSetting("HF_IMAGE_GUIDANCE", 3.5, 1, 15),
    ...(seed
      ? { seed: numberSetting("HF_IMAGE_SEED", 0, 0, 2147483647, true) }
      : {}),
  };
}

export function getVisionConfig() {
  const model = getEnv("HF_VISION_MODEL");
  const provider = getEnv("HF_VISION_PROVIDER");
  if (!(INFERENCE_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(
      "HF_VISION_PROVIDER must name an explicit supported provider (not auto)",
    );
  }
  return { model, provider: provider as InferenceProvider };
}

export function getTemplate(): "light" | "dark" {
  const template = process.env.MEME_TEMPLATE?.trim() || "light";
  if (template !== "light" && template !== "dark")
    throw new Error("MEME_TEMPLATE must be light or dark");
  return template;
}

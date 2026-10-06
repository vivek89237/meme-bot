import { generateImage } from "../services/images.js";
import {
  ImageQualityError,
  reviewImage,
  validateImageBytes,
} from "../services/imageQuality.js";
import { layoutCaption, renderMeme } from "../services/renderMeme.js";
import type { MemeIdea } from "../memes/types.js";

const defaultServices = { generateImage, reviewImage, renderMeme };

/** At most two generations; external failures and unavailable reviewers never bypass the gate. */
export async function createMemeImage(
  idea: MemeIdea,
  services = defaultServices,
): Promise<Buffer> {
  layoutCaption(idea.topText);
  layoutCaption(idea.bottomText);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const artwork = await services.generateImage(idea.visualPrompt, attempt);
      await validateImageBytes(artwork, "artwork");
      await services.reviewImage(artwork, "artwork", idea);
      const finalImage = await services.renderMeme(
        artwork,
        idea.topText,
        idea.bottomText,
      );
      await validateImageBytes(finalImage, "final");
      await services.reviewImage(finalImage, "final", idea);
      return finalImage;
    } catch (error) {
      if (!(error instanceof ImageQualityError) || attempt === 1) throw error;
      console.warn(
        "Image failed quality checks; regenerating artwork once before giving up",
      );
    }
  }
  throw new ImageQualityError("No image passed quality checks");
}

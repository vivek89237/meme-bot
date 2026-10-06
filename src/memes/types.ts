export interface MemeIdea {
  topText: string;
  bottomText: string;
  visualPrompt: string;
  /** Exact caption stored in the pool and published below the image. */
  text: string;
  category: string;
  hash: string;
}

export interface ReviewedIdea extends MemeIdea {
  score: number;
  reason: string;
}

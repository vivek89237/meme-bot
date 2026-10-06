export interface MemeIdea {
  text: string;
  category: string;
  hash: string;
}

export interface ReviewedIdea extends MemeIdea {
  score: number;
  reason: string;
}

import { reviewMeme } from "../memes/review.js";
import { run } from "./run.js";

run(async () =>
  console.log(
    await reviewMeme(
      process.argv.slice(2).join(" ") ||
        "When production works but localhost doesn't 😂",
    ),
  ),
);

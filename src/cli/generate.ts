import { generateMeme } from "../memes/generate.js";
import { run } from "./run.js";

run(async () => console.log(await generateMeme()));

/** Shared creative instructions keep idea generation and artwork on the same theme. */
export const COUPLE_CHARACTERS = `Bubu and Dudu: a cute white panda and a warm light-brown bear.
Both have small rounded bodies, large round heads, tiny rounded ears, short limbs,
simple dark dot eyes, tiny expressive mouths, and soft blush on their cheeks.
The white panda has dark brown ears; the brown bear has darker brown outlines and ears.
Keep the two characters distinct, with consistent colors, proportions and facial features.`;

export const COUPLE_HASHTAGS =
  "#memes #bubududu #couplememes #relationshipmemes #love #relatable";

export const IDEA_PROMPT = `Generate 5 original, wholesome, funny Bubu-Dudu couple memes suitable for Instagram.
Characters: ${COUPLE_CHARACTERS}
Focus on everyday relationship moments: wanting hugs during work, stealing snacks,
sharing blankets, playful mock sulking, missing each other, sleepy cuddles, little surprises,
and saying one thing while affectionately doing the opposite.
Make each idea different. The joke should have a short setup and a sweet, surprising punchline.
Avoid developer/programming jokes, sexual content, cruelty, controlling behavior and mean stereotypes.

Each meme must have topText (setup or first line of dialogue), bottomText (punchline or reply),
visualPrompt (one illustration description), and category.
Each caption panel must have at most 90 characters and 14 words. Use natural, grammatically correct English.
Proofread spelling and grammar. No repeated words, hashtags or emoji in captions.
Prefer simple conversational lines that are easy to understand at a glance.
Do not place the character descriptions or the names Bubu/Dudu in captions unless needed for the joke.

visualPrompt must describe ONE coherent scene featuring BOTH the white panda and brown bear,
their facial expressions, their interaction, and a simple cozy setting.
Make the affection and visual joke evident without readable text.
Do not describe a multi-panel comic, split screen, before/after sequence or several scenes.
Do not include caption wording, written text, speech bubbles, signs or readable computer screens.
Return ONLY a JSON array, for example:
[{"topText":"Me: I need to finish my work.","bottomText":"You: First, finish this hug.","visualPrompt":"The white panda sits at a low desk with an open laptop showing abstract shapes. The light-brown bear gently hugs the panda from behind. The panda looks surprised but happy, and the bear smiles affectionately. Both full bodies are visible in one cozy scene with a plain cream background.","category":"cuddles"}]`;

export const ARTWORK_STYLE = `Create a cute Bubu-Dudu couple-meme illustration.
Recurring character design: ${COUPLE_CHARACTERS}
Style: simple kawaii 2D sticker cartoon, clean rounded dark-brown outlines,
flat white and warm light-brown character colors, pastel pink blush,
minimal shading, soft cream or pale pastel background, very few props.
Use expressive poses and readable emotions: tiny smiles, affectionate pouting, hugs and sleepy cuddles.
The mood is warm, playful and tender. Avoid realistic fur, photographic rendering, 3D,
dramatic lighting, complicated scenery, extra characters or human figures.
Show exactly one white panda and one brown bear, with their bodies and expressions clearly visible.
Use ONE coherent landscape 4:3 scene with breathing room around the edges.
No grids, panel borders, collages, split screens or duplicated characters.
Render artwork only. No text, letters, numbers, captions, speech bubbles, UI labels, logos or watermarks.
Computer displays must use abstract shapes rather than readable text. Do not draw caption panels.`;

export const COUPLE_REVIEW_CRITERIA = `Rate wholesome couple humor, everyday relationship relatability,
affectionate chemistry, a clear setup/punchline, originality and visual clarity from 0 to 100.
The scene should feature the white panda and light-brown bear interacting affectionately in one scene.
Favor playful, sweet jokes rather than generic romantic slogans. Reject cruel, sexual or controlling themes.`;

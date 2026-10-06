# Instagram Meme Bot

A TypeScript command-line workflow that generates developer meme ideas with Hugging Face, reviews and deduplicates them, generates an image, uploads it to Supabase, and publishes it to Instagram.

## Development

Use Node.js 22, matching GitHub Actions.

```sh
npm ci
npm run typecheck
npm test
npm run generate
npm run review -- "When production works but localhost doesn't"
```

Generation and basic review work locally without credentials. Tests use mocked HTTP responses and do not contact external services.

## Project layout

```text
src/
  cli/          npm command entry points and error handling
  config/       environment loading and validation
  memes/        local caption generation, basic review, and shared idea types
  services/     AI ideas/artwork, caption rendering, quality checks, storage, Instagram API
  utils/        shared text and hash helpers
  workflows/    full agent orchestration and gated meme composition
assets/fonts/   bundled font and redistribution license
tests/          local behavior and mocked integration tests
```

Imports from services and workflows do not start commands or require credentials. Each CLI command calls the relevant workflow or service explicitly. The obsolete root `index.js` placeholder has been removed; use the npm commands below.

## Live configuration

Copy `.env.example` to `.env` and supply your own values securely. `.env` is ignored by Git. Never commit credentials.

| Variable                    | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `HF_TOKEN`                  | Hugging Face inference access token                       |
| `HF_MODEL`                  | Chat model used to generate and review ideas              |
| `HF_IMAGE_MODEL`            | Image-generation model supported by an inference provider |
| `SUPABASE_URL`              | Supabase project URL                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret API key or legacy service-role JWT                 |
| `SUPABASE_BUCKET`           | Storage bucket; defaults to `Meme`                        |
| `INSTAGRAM_USER_ID`         | Instagram account ID                                      |
| `INSTAGRAM_ACCESS_TOKEN`    | Instagram or Facebook Graph access token                  |
| `GRAPH_API_VERSION`         | Graph API version; defaults to `v24.0`                    |

The Supabase project must already contain the `meme_pool` table used by `src/services/pool.ts` and the configured Storage bucket. Pool queries use `id`, `created_at`, `image_url`, `source_url`, `caption`, `status`, `posted_at`, `ai_score`, `ai_reason`, `category`, and `hash`. This repository does not include database migrations. Image uploads produce two-hour signed URLs so Instagram can fetch images from a private bucket.

## Commands

```sh
# Generate artwork only: describe a visual scene, without caption wording
npm run image -- "A relieved developer celebrating beside three warning lights"

# Render exact captions locally using the bundled font (no credentials needed)
npm run render -- generated/artwork.png "Finally fixed the bug." "Accidentally added three new features."

# Upload the finished JPEG and print its signed URL
npm run upload -- generated/meme.jpg

# Upload and publish an existing image to Instagram
npm run publish -- ./test-meme.jpg "Your caption"

# Run the complete generation, review, upload, and publishing pipeline
npm run agent
```

`image` requires Hugging Face configuration; `upload` requires Supabase configuration; `publish` requires Supabase and Instagram configuration; `agent` requires all three integrations. `publish` and `agent` create real Instagram posts. The full agent passes the reviewed final JPEG directly to storage without overwriting the tracked example images. `upload` uses unique filenames and signed URLs.

The scheduled GitHub Actions workflow runs the agent with repository secrets. Local tests validate module behavior and mocked integrations; they do not establish that live credentials, model access, database schema, or Instagram permissions work.

## Consistent image quality

The agent now runs this pipeline:

1. Generate separate `topText`, `bottomText`, and `visualPrompt` fields. Validate caption length and reject repeated words, then use the chat model to check spelling, grammar, and joke quality before selection.
2. Generate artwork without any caption wording. Use a consistent cartoon style, an explicit model/provider, and fixed 1024 × 768 dimensions. The default profile is FLUX.1-dev on fal-ai with 28 steps and guidance 3.5. It requires provider/model access and inference credit. Alternate models may require different step/guidance settings; unsupported combinations fail rather than switching providers automatically.
3. Check that the artwork decodes, has sufficient resolution and visual variation, then have the configured vision model reject unwanted lettering, blur, poor composition, or an irrelevant scene.
4. Render the approved text into fixed top and bottom panels on a 1080 × 1350 canvas using Sharp and bundled DejaVu Sans Bold. Fontkit measures and shapes the glyphs; SVG vector paths avoid reliance on fonts installed on the host. Both templates use high-contrast text, fixed margins, and a central 1080 × 810 artwork area.
5. Verify the finished JPEG and have the vision model independently transcribe the visible captions. Any mismatch, clipped text, or failed visual check blocks upload and publishing. A quality rejection permits one additional artwork generation; missing configuration, malformed reviewer responses, or API failures stop immediately. There is no automatic approval fallback.

Captions are limited to 90 characters and 14 words per panel, and at most three lines at 48–64 px. Captions that cannot fit or contain unsupported font characters are rejected, never truncated or silently altered. Generated captions exclude emoji. Spelling and visual judgments are model-based and can still make mistakes; deterministic rendering preserves the approved wording, and manual inspection is useful when selecting a new model/profile.

`npm run image` saves artwork to `generated/artwork.png` by default and performs local image checks. `npm run render` creates `generated/meme.jpg` without calling a vision model, making it useful for previewing layouts offline. These manual commands do not run the agent's AI quality gate; `upload` and `publish` remain explicit manual operations. The gate applies to `npm run agent`.

Set `HF_VISION_MODEL` and `HF_VISION_PROVIDER` to a supported vision/chat combination in `.env` and in GitHub Actions repository variables before running the agent. The scheduled workflow reads image settings from repository variables (with the existing image-model secret as a fallback), reuses `HF_TOKEN`, and runs type checking and tests before the agent. In restricted environments allow the selected inference destinations and any provider image-download host. A seed helps reproduce artwork under the same provider/model/settings; it does not guarantee identical output across provider updates or improve quality by itself.

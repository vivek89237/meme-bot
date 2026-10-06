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
  services/     Hugging Face ideas/images, Supabase pool/storage, Instagram API
  utils/        shared text and hash helpers
  workflows/    full agent orchestration
tests/         local behavior and mocked integration tests
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
# Generate an image and save it in the ignored generated/ directory
npm run image -- "A funny developer meme" [output.png]

# Upload an existing PNG/JPEG and print its signed URL
npm run upload -- generated/meme.png

# Upload and publish an existing image to Instagram
npm run publish -- ./test-meme.jpg "Your caption"

# Run the complete generation, review, upload, and publishing pipeline
npm run agent
```

`image` requires Hugging Face configuration; `upload` requires Supabase configuration; `publish` requires Supabase and Instagram configuration; `agent` requires all three integrations. `publish` and `agent` create real Instagram posts. The full agent passes image bytes directly to storage without overwriting the tracked example images. `upload` uses unique filenames and signed URLs.

The scheduled GitHub Actions workflow runs the agent with repository secrets. Local tests validate module behavior and mocked integrations; they do not establish that live credentials, model access, database schema, or Instagram permissions work.

import "dotenv/config";
import fs from "fs";
import path from "path";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

function isServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  if (key.startsWith("sb_publishable_")) return false;

  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

const {
  INSTAGRAM_USER_ID,
  INSTAGRAM_ACCESS_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET,
} = process.env;

if (
  !INSTAGRAM_USER_ID ||
  !INSTAGRAM_ACCESS_TOKEN ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !SUPABASE_BUCKET
) {
  throw new Error("Missing environment variables");
}

if (!isServiceRoleKey(SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is a publishable/anon key. Uploads are blocked by Storage RLS. In the Supabase dashboard go to Project Settings → API and paste the secret key (sb_secret_...) or the legacy service_role JWT."
  );
}

const INSTAGRAM_TOKEN = INSTAGRAM_ACCESS_TOKEN.trim();
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION?.trim() || "v24.0";
const GRAPH_API_HOST = INSTAGRAM_TOKEN.startsWith("IG")
  ? "https://graph.instagram.com"
  : "https://graph.facebook.com";
const graphUrl = (path: string) =>
  `${GRAPH_API_HOST}/${GRAPH_API_VERSION}/${path}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    // Node 20 has no native WebSocket; supabase-js still boots Realtime on createClient
    transport: WebSocket as never,
  },
});

const IMAGE_PATH = process.argv[2];
const CAPTION =
  process.argv.slice(3).join(" ") || "API test 🚀";

if (!IMAGE_PATH) {
  throw new Error(
    'Usage: npm run publish -- ./meme.jpg "Your caption"'
  );
}

async function uploadToSupabase(): Promise<string> {
  console.log("Uploading image to Supabase...");

  const fileBuffer = fs.readFileSync(IMAGE_PATH);

  const filename = `${Date.now()}-${path.basename(IMAGE_PATH)}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filename, fileBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Bucket is private, so getPublicUrl() 404s as JSON and Instagram rejects it.
  // A signed URL is a normal GET that returns image/jpeg.
  const { data: signed, error: signError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(filename, 60 * 60 * 2);

  if (signError || !signed?.signedUrl) {
    throw new Error(
      `Could not create signed URL: ${signError?.message ?? "unknown error"}`
    );
  }

  console.log("Uploaded:");
  console.log(signed.signedUrl);

  return signed.signedUrl;
}

async function createMediaContainer(
  imageUrl: string
): Promise<string> {
  console.log("Creating Instagram media container...");

  const response = await axios.post(
    graphUrl(`${INSTAGRAM_USER_ID}/media`),
    {
      image_url: imageUrl,
      caption: CAPTION,
    },
    {
      params: { access_token: INSTAGRAM_TOKEN },
    }
  );

  return response.data.id;
}

async function waitForContainer(
  containerId: string
): Promise<void> {
  console.log("Waiting for Instagram to process the image...");

  for (let i = 0; i < 20; i++) {
    const response = await axios.get(
      graphUrl(containerId),
      {
        params: {
          fields: "status_code",
          access_token: INSTAGRAM_TOKEN,
        },
      }
    );

    const status = response.data.status_code;

    console.log(`Status: ${status}`);

    if (status === "FINISHED") {
      return;
    }

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(
        `Instagram container failed: ${status}`
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 3000)
    );
  }

  throw new Error("Instagram processing timed out");
}

async function publishMedia(
  containerId: string
): Promise<string> {
  console.log("Publishing to Instagram...");

  const response = await axios.post(
    graphUrl(`${INSTAGRAM_USER_ID}/media_publish`),
    {
      creation_id: containerId,
    },
    {
      params: { access_token: INSTAGRAM_TOKEN },
    }
  );

  return response.data.id;
}

async function getPermalink(
  mediaId: string
): Promise<string | undefined> {
  const response = await axios.get(
    graphUrl(mediaId),
    {
      params: {
        fields: "id,media_type,permalink",
        access_token: INSTAGRAM_TOKEN,
      },
    }
  );

  return response.data.permalink;
}

async function main() {
  try {
    const imageUrl = await uploadToSupabase();

    const containerId =
      await createMediaContainer(imageUrl);

    console.log("Container:", containerId);

    await waitForContainer(containerId);

    const mediaId =
      await publishMedia(containerId);

    console.log("Instagram media:", mediaId);

    const permalink =
      await getPermalink(mediaId);

    console.log("Instagram post:", permalink);

    console.log("\n✅ Published successfully!");
  } catch (error: any) {
    console.error(
      "\n❌ Publishing failed:",
      error.response?.data || error.message
    );

    process.exit(1);
  }
}

main();
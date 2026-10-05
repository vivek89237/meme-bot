import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

dotenv.config();

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }

  return value;
}

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_BUCKET = getEnv("SUPABASE_BUCKET");

// Realtime transport is unnecessary for Storage uploads
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function uploadImage() {
  const filePath = "test-generated-meme.png";

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = `1791233813918.png`;

  console.log("☁️ Uploading image to Supabase...");

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(fileName, fileBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

 const { data: publicUrlData } = supabase.storage
  .from(SUPABASE_BUCKET)
  .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    console.log("📦 Bucket:", SUPABASE_BUCKET, publicUrlData);
    console.log("📁 File:", fileName);
    console.log("🔗 Public URL:", publicUrl);

    return publicUrl;
}

uploadImage().catch((error) => {
  console.error("❌ Upload failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
import { getSupabaseClient } from "./supabase.js";

export async function uploadImage(
  imageBuffer: Buffer,
  contentType = "image/png",
): Promise<string> {
  console.log("\n☁️ Uploading image to Supabase...");

  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${contentType === "image/jpeg" ? "jpg" : "png"}`;

  const { error } = await getSupabaseClient()
    .storage.from(process.env.SUPABASE_BUCKET?.trim() || "Meme")
    .upload(fileName, imageBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  console.log("✅ Image uploaded");

  // IMPORTANT:
  // The Meme bucket is private.
  // Instagram needs a signed URL that it can fetch directly.
  const { data: signed, error: signError } = await getSupabaseClient()
    .storage.from(process.env.SUPABASE_BUCKET?.trim() || "Meme")
    .createSignedUrl(fileName, 60 * 60 * 2);

  if (signError || !signed?.signedUrl) {
    throw new Error(
      `Could not create signed URL: ${signError?.message ?? "unknown error"}`,
    );
  }

  console.log("✅ Signed URL generated for Instagram");

  return signed.signedUrl;
}

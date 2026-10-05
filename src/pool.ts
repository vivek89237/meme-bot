import dotenv from "dotenv";
import { createSupabaseClient } from "./supabaseClient.js";

dotenv.config();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase = createSupabaseClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

export interface MemePoolItem {
  id?: string;
  created_at?: string;
  image_url: string;
  source_url?: string | null;
  caption?: string | null;
  status?: string;
  posted_at?: string | null;
  ai_score?: number | null;
  ai_reason?: string | null;
  category?: string | null;
  hash?: string | null;
}

/**
 * Add a meme to the meme pool
 */
export async function addToPool(
  meme: MemePoolItem
): Promise<MemePoolItem> {
  const { data, error } = await supabase
    .from("meme_pool")
    .insert({
      image_url: meme.image_url,
      source_url: meme.source_url ?? null,
      caption: meme.caption ?? null,
      status: meme.status ?? "pending",
      ai_score: meme.ai_score ?? null,
      ai_reason: meme.ai_reason ?? null,
      category: meme.category ?? null,
      hash: meme.hash ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to add meme to pool: ${error.message}`
    );
  }

  console.log("Meme added to pool:", data.id);

  return data;
}

/**
 * Get the next approved meme
 */
export async function getNextApprovedMeme(): Promise<
  MemePoolItem | null
> {
  const { data, error } = await supabase
    .from("meme_pool")
    .select("*")
    .eq("status", "approved")
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch approved meme: ${error.message}`
    );
  }

  return data;
}

/**
 * Mark a meme as posted
 */
export async function markAsPosted(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("meme_pool")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `Failed to mark meme as posted: ${error.message}`
    );
  }

  console.log(`Meme ${id} marked as posted`);
}

/**
 * Check whether a hash already exists
 */
export async function hashExists(
  hash: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("meme_pool")
    .select("id")
    .eq("hash", hash)
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to check duplicate hash: ${error.message}`
    );
  }

  return data.length > 0;
}
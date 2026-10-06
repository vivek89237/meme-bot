import {
  createClient,
  type WebSocketLikeConstructor,
} from "@supabase/supabase-js";
import WebSocket from "ws";
import { getEnv } from "../config/env.js";

export function createSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  });
}

let client: ReturnType<typeof createSupabaseClient> | undefined;
export function getSupabaseClient() {
  return (client ??= createSupabaseClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  ));
}

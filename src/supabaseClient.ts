import {
  createClient,
  type WebSocketLikeConstructor,
} from "@supabase/supabase-js";
import WebSocket from "ws";

export function createSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    realtime: {
      transport: WebSocket as unknown as WebSocketLikeConstructor,
    },
  });
}

import "dotenv/config";

export function getEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function getInstagramConfig() {
  const token = getEnv("INSTAGRAM_ACCESS_TOKEN");
  const userId = getEnv("INSTAGRAM_USER_ID");
  const version = process.env.GRAPH_API_VERSION?.trim() || "v24.0";
  const host = token.startsWith("IG")
    ? "https://graph.instagram.com"
    : "https://graph.facebook.com";
  return {
    token,
    userId,
    host,
    graphUrl: (path: string) => `${host}/${version}/${path}`,
  };
}

export function isServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  if (key.startsWith("sb_publishable_")) return false;

  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

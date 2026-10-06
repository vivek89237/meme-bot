import { getInstagramConfig } from "../config/env.js";

export async function createInstagramContainer(
  imageUrl: string,
  caption: string,
): Promise<string> {
  const {
    token: INSTAGRAM_TOKEN,
    userId: INSTAGRAM_USER_ID,
    host: GRAPH_API_HOST,
    graphUrl,
  } = getInstagramConfig();
  console.log("\n📸 Creating Instagram media container...");

  console.log(`🔐 Instagram API host: ${GRAPH_API_HOST}`);

  const response = await fetch(graphUrl(`${INSTAGRAM_USER_ID}/media`), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: INSTAGRAM_TOKEN,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(
      `Instagram media creation failed: ${JSON.stringify(result)}`,
    );
  }

  if (!result.id) {
    throw new Error("Instagram did not return a creation ID");
  }

  console.log(`✅ Creation ID: ${result.id}`);

  return result.id;
}

export async function waitForInstagramContainer(
  creationId: string,
): Promise<void> {
  const { token: INSTAGRAM_TOKEN, graphUrl } = getInstagramConfig();
  console.log("\n⏳ Waiting for Instagram to process image...");

  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await fetch(
      graphUrl(
        `${creationId}?fields=status_code&access_token=${encodeURIComponent(INSTAGRAM_TOKEN)}`,
      ),
    );

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(
        `Instagram status check failed: ${JSON.stringify(result)}`,
      );
    }

    console.log(`⏳ Attempt ${attempt}/${maxAttempts}: ${result.status_code}`);

    if (result.status_code === "FINISHED") {
      console.log("✅ Instagram container ready");

      return;
    }

    if (result.status_code === "ERROR" || result.status_code === "EXPIRED") {
      throw new Error(`Instagram container failed: ${JSON.stringify(result)}`);
    }
  }

  throw new Error("Instagram container processing timed out");
}

export async function publishToInstagram(
  creationId: string,
): Promise<string | null> {
  const {
    token: INSTAGRAM_TOKEN,
    userId: INSTAGRAM_USER_ID,
    graphUrl,
  } = getInstagramConfig();
  console.log("\n🚀 Publishing to Instagram...");

  const response = await fetch(graphUrl(`${INSTAGRAM_USER_ID}/media_publish`), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: INSTAGRAM_TOKEN,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(`Instagram publishing failed: ${JSON.stringify(result)}`);
  }

  console.log(`✅ Instagram published: ${result.id}`);

  // Try to retrieve permalink
  try {
    const permalinkResponse = await fetch(
      graphUrl(
        `${result.id}?fields=permalink&access_token=${encodeURIComponent(
          INSTAGRAM_TOKEN,
        )}`,
      ),
    );

    const permalinkResult = await permalinkResponse.json();

    if (permalinkResult.permalink) {
      console.log(`🔗 ${permalinkResult.permalink}`);

      return permalinkResult.permalink;
    }
  } catch {
    // Publishing already succeeded.
  }

  return null;
}

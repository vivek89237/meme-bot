import {
  getProviderHelper,
  makeRequestOptionsFromResolvedModel,
  type chatCompletion as SDKChatCompletion,
  type InferenceProviderMappingEntry,
} from "@huggingface/inference";
import { getEnv } from "../config/env.js";
import type { buildImageRequest } from "./images.js";

type ChatCompletionInput = Parameters<typeof SDKChatCompletion>[0];
type ChatCompletionOutput = Awaited<ReturnType<typeof SDKChatCompletion>>;

const ROUTER = "https://router.huggingface.co";

async function request(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getEnv("HF_TOKEN")}`);
  const response = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    // Avoid exposing provider response bodies, request headers, or proxy credentials.
    throw new Error(
      `Hugging Face request failed (HTTP ${response.status}) at ${new URL(url).hostname}`,
    );
  }
  return response;
}

/** Always use HF's supported HTTPS router, including when the token is a proxy binding. */
export async function chatCompletion(
  input: ChatCompletionInput & { provider?: string },
): Promise<ChatCompletionOutput> {
  const {
    provider,
    accessToken: _accessToken,
    endpointUrl: _endpointUrl,
    urlTransform: _urlTransform,
    ...payload
  } = input;
  if (typeof input.model !== "string" || !input.model.trim())
    throw new Error("A chat model is required");
  const model = provider
    ? `${input.model?.split(":")[0]}:${provider}`
    : input.model;
  const response = await request(`${ROUTER}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      model,
      ...(model?.includes("gpt-oss")
        ? {
            reasoning_effort: "low",
            max_tokens: Math.max(input.max_tokens ?? 0, 2048),
          }
        : {}),
    }),
  });
  const result = await response.json();
  if (!Array.isArray(result.choices) || !result.choices[0]?.message)
    throw new Error("Invalid Hugging Face chat response");
  if (
    typeof result.choices[0].message.content !== "string" ||
    !result.choices[0].message.content.trim()
  ) {
    throw new Error(
      `Hugging Face returned no answer (finish reason: ${result.choices[0].finish_reason ?? "unknown"})`,
    );
  }
  return result;
}

/** Reuse the SDK's provider adapters while keeping authentication on the HF proxy route. */
export async function textToImage(
  input: ReturnType<typeof buildImageRequest>,
): Promise<unknown> {
  const response = await request(
    `https://huggingface.co/api/models/${input.model}?expand[]=inferenceProviderMapping`,
  );
  const data = await response.json();
  const raw = data.inferenceProviderMapping;
  const entry = Array.isArray(raw)
    ? raw.find((entry) => entry.provider === input.provider)
    : raw?.[input.provider];
  if (
    !entry ||
    entry.status !== "live" ||
    entry.task !== "text-to-image" ||
    typeof entry.providerId !== "string"
  ) {
    throw new Error(
      "Image model/provider pair is not currently live for text-to-image",
    );
  }
  const mapping: InferenceProviderMappingEntry = {
    ...entry,
    provider: input.provider,
    hfModelId: input.model,
  };
  const helper = getProviderHelper(input.provider, "text-to-image");
  // Do not give the SDK a placeholder to classify as an unrelated provider API key.
  const { url, info } = makeRequestOptionsFromResolvedModel(
    entry.providerId,
    helper,
    input,
    mapping,
    { task: "text-to-image", outputType: "blob" },
  );
  if (new URL(url).origin !== ROUTER)
    throw new Error("Image requests must use the Hugging Face router");
  const headers = new Headers(info.headers);
  headers.set("Authorization", `Bearer ${getEnv("HF_TOKEN")}`);
  const signal = AbortSignal.timeout(180_000);
  const imageResponse = await request(url, { ...info, headers, signal });
  const output = imageResponse.headers
    .get("content-type")
    ?.includes("application/json")
    ? await imageResponse.json()
    : await imageResponse.blob();
  return helper.getResponse(
    output,
    url,
    Object.fromEntries(headers.entries()),
    "blob",
    signal,
  );
}

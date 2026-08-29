import { GeminiProvider } from "@/ai/providers/gemini";
import type { AiProvider } from "@/ai/providers/types";

let cached: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (!cached) cached = new GeminiProvider();
  return cached;
}

export function setProviderForTests(provider: AiProvider | null) {
  cached = provider;
}

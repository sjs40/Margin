import { AsyncLocalStorage } from "node:async_hooks";
import { GeminiProvider } from "@/ai/providers/gemini";
import type { AiProvider } from "@/ai/providers/types";

const storage = new AsyncLocalStorage<AiProvider>();
let testOverride: AiProvider | null = null;

export function getProvider(): AiProvider {
  const current = storage.getStore() ?? testOverride;
  if (!current) {
    throw new Error("AI provider is not bound for this request");
  }
  return current;
}

export function getOptionalProvider(): AiProvider | null {
  return storage.getStore() ?? testOverride;
}

export function runWithProvider<T>(provider: AiProvider, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(provider, fn);
}

export function setProviderForTests(provider: AiProvider | null) {
  testOverride = provider;
}

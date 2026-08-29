import type { AiProvider } from "@/ai/providers/types";

export class OpenRouterProvider implements AiProvider {
  readonly name = "openrouter";

  async completeStructured(): Promise<never> {
    throw new Error("OpenRouter is not enabled in V0.1.");
  }

  async completeText(): Promise<never> {
    throw new Error("OpenRouter is not enabled in V0.1.");
  }

  async embed(): Promise<never> {
    throw new Error("OpenRouter is not enabled in V0.1.");
  }
}

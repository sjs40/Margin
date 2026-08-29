import type { z } from "zod";

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export type GenerateTextInput = {
  model: string;
  prompt: string;
  system?: string;
  thinkingLevel?: ThinkingLevel;
  image?: { mimeType: string; dataBase64: string };
};

export type GenerateObjectInput<T extends z.ZodType> = GenerateTextInput & {
  schema: T;
};

export type ProviderResult<T> = {
  data: T;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
  provider: string;
};

export type EmbeddingResult = {
  values: number[];
  inputTokens: number;
  latencyMs: number;
  model: string;
};

export interface AiProvider {
  readonly name: string;
  completeStructured<T extends z.ZodType>(
    input: GenerateObjectInput<T>,
  ): Promise<ProviderResult<z.infer<T>>>;
  completeText(input: GenerateTextInput): Promise<ProviderResult<string>>;
  embed(input: { text: string; model: string; dimensions: number }): Promise<EmbeddingResult>;
}

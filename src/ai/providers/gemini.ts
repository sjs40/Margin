import { GoogleGenAI, ThinkingLevel as GeminiThinkingLevel } from "@google/genai";
import { z } from "zod";
import { aiConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  AiProvider,
  EmbeddingResult,
  GenerateObjectInput,
  GenerateTextInput,
  ProviderResult,
  ThinkingLevel,
} from "@/ai/providers/types";

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const maybe = z as unknown as {
    toJSONSchema?: (schema: z.ZodType) => Record<string, unknown>;
  };
  if (typeof maybe.toJSONSchema === "function") {
    return maybe.toJSONSchema(schema);
  }
  throw new Error("Zod toJSONSchema is unavailable. Use Zod 4.");
}

function thinkingConfig(level?: ThinkingLevel) {
  if (!level) return undefined;
  switch (level) {
    case "minimal":
      return { thinkingLevel: GeminiThinkingLevel.MINIMAL };
    case "low":
      return { thinkingLevel: GeminiThinkingLevel.LOW };
    case "medium":
      return { thinkingLevel: GeminiThinkingLevel.MEDIUM };
    case "high":
      return { thinkingLevel: GeminiThinkingLevel.HIGH };
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

function extractText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const record = response as {
    text?: string;
    output_text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (typeof record.text === "string" && record.text) return record.text;
  if (typeof record.output_text === "string" && record.output_text) {
    return record.output_text;
  }
  const parts = record.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("");
}

function usage(response: unknown): { inputTokens: number; outputTokens: number } {
  const record = response as {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
    usage?: {
      promptTokens?: number;
      candidatesTokens?: number;
      total_input_tokens?: number;
      total_output_tokens?: number;
    };
  };
  return {
    inputTokens:
      record.usageMetadata?.promptTokenCount ??
      record.usage?.promptTokens ??
      record.usage?.total_input_tokens ??
      0,
    outputTokens:
      record.usageMetadata?.candidatesTokenCount ??
      record.usage?.candidatesTokens ??
      record.usage?.total_output_tokens ??
      0,
  };
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(apiKey = aiConfig.geminiApiKey) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async completeStructured<T extends z.ZodType>(
    input: GenerateObjectInput<T>,
  ): Promise<ProviderResult<z.infer<T>>> {
    const started = Date.now();
    const jsonSchema = toJsonSchema(input.schema);
    const contents = this.buildContents(input);
    const response = await this.client.models.generateContent({
      model: input.model,
      contents,
      config: {
        systemInstruction: input.system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        thinkingConfig: thinkingConfig(input.thinkingLevel),
      },
    });
    const rawText = extractText(response);
    const parsedJson: unknown = JSON.parse(rawText);
    const parsed = input.schema.safeParse(parsedJson);
    const tokens = usage(response);
    if (!parsed.success) {
      logger.warn("gemini_schema_invalid", {
        model: input.model,
        issues: parsed.error.issues.length,
      });
      throw new Error(`Structured output failed validation: ${parsed.error.message}`);
    }
    return {
      data: parsed.data,
      rawText,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      latencyMs: Date.now() - started,
      model: input.model,
      provider: this.name,
    };
  }

  async completeText(input: GenerateTextInput): Promise<ProviderResult<string>> {
    const started = Date.now();
    const response = await this.client.models.generateContent({
      model: input.model,
      contents: this.buildContents(input),
      config: {
        systemInstruction: input.system,
        thinkingConfig: thinkingConfig(input.thinkingLevel),
      },
    });
    const rawText = extractText(response);
    const tokens = usage(response);
    return {
      data: rawText,
      rawText,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      latencyMs: Date.now() - started,
      model: input.model,
      provider: this.name,
    };
  }

  async embed(input: {
    text: string;
    model: string;
    dimensions: number;
  }): Promise<EmbeddingResult> {
    const started = Date.now();
    const response = await this.client.models.embedContent({
      model: input.model,
      contents: `Task: retrieve semantically similar investment research.\n${input.text}`,
      config: { outputDimensionality: input.dimensions },
    });
    const values = response.embeddings?.[0]?.values ?? [];
    return {
      values,
      inputTokens: Math.ceil(input.text.length / 4),
      latencyMs: Date.now() - started,
      model: input.model,
    };
  }

  private buildContents(input: GenerateTextInput) {
    const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
    if (input.image) {
      parts.unshift({
        inlineData: {
          mimeType: input.image.mimeType,
          data: input.image.dataBase64,
        },
      });
    }
    return [{ role: "user", parts }];
  }
}

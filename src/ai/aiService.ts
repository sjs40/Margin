import { z } from "zod";
import { getProvider } from "@/ai/modelRouter";
import { aiConfig } from "@/lib/env";
import { estimateGenerationCost, roundCost } from "@/lib/cost";
import { logger } from "@/lib/logger";
import type { ThinkingLevel } from "@/ai/providers/types";

export class StructuredOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export async function generateStructured<T extends z.ZodType>(input: {
  schema: T;
  prompt: string;
  model: string;
  thinkingLevel?: ThinkingLevel;
  image?: { mimeType: string; dataBase64: string };
  promptVersion: string;
  jobType: string;
}): Promise<{
  data: z.infer<T>;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  latencyMs: number;
  model: string;
  provider: string;
  promptVersion: string;
}> {
  const provider = getProvider();
  try {
    const result = await provider.completeStructured({
      model: input.model,
      prompt: input.prompt,
      schema: input.schema,
      thinkingLevel: input.thinkingLevel,
      image: input.image,
    });
    return {
      ...result,
      estimatedCost: roundCost(
        estimateGenerationCost(result.inputTokens, result.outputTokens),
      ),
      promptVersion: input.promptVersion,
    };
  } catch {
    logger.warn("ai_structured_retry", {
      jobType: input.jobType,
      promptVersion: input.promptVersion,
    });
    try {
      const repaired = await provider.completeStructured({
        model: input.model,
        prompt: `${input.prompt}\n\nYour previous output was invalid. Return JSON that exactly matches the schema. Do not include markdown fences.`,
        schema: input.schema,
        thinkingLevel: input.thinkingLevel,
        image: input.image,
      });
      return {
        ...repaired,
        estimatedCost: roundCost(
          estimateGenerationCost(repaired.inputTokens, repaired.outputTokens),
        ),
        promptVersion: input.promptVersion,
      };
    } catch (retryError) {
      const message =
        retryError instanceof Error ? retryError.message : "Invalid structured output";
      throw new StructuredOutputError(message);
    }
  }
}

export async function embedText(text: string) {
  const provider = getProvider();
  return provider.embed({
    text,
    model: aiConfig.embeddingModel,
    dimensions: aiConfig.embeddingDimensions,
  });
}

export { aiConfig };

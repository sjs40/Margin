const FLASH_INPUT_PER_MILLION = 0.75;
const FLASH_OUTPUT_PER_MILLION = 3.75;
const EMBEDDING_PER_MILLION = 0.15;

export function estimateGenerationCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * FLASH_INPUT_PER_MILLION +
    (outputTokens / 1_000_000) * FLASH_OUTPUT_PER_MILLION
  );
}

export function estimateEmbeddingCost(inputTokens: number): number {
  return (inputTokens / 1_000_000) * EMBEDDING_PER_MILLION;
}

export function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

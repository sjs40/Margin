import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { estimateEmbeddingCost, roundCost } from "@/lib/cost";
import type { EmbeddingSourceType } from "@/types/domain";

type Admin = ReturnType<typeof createAdminClient>;

export async function upsertEmbedding(
  supabase: Admin,
  input: {
    userId: string;
    sourceType: EmbeddingSourceType;
    sourceId: string;
    chunkIndex: number;
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (!input.content.trim()) return;
  const embedded = await ai.embed(input.content);
  await supabase.from("embeddings").upsert(
    {
      user_id: input.userId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      chunk_index: input.chunkIndex,
      content: input.content,
      embedding: embedded.values,
      metadata: input.metadata ?? {},
    },
    { onConflict: "user_id,source_type,source_id,chunk_index" },
  );
  return roundCost(estimateEmbeddingCost(embedded.inputTokens));
}

export function knowledgeEmbeddingText(input: { title: string; summary: string; body: string }) {
  return [input.title, input.summary, input.body].filter(Boolean).join("\n\n");
}

"use server";

import { requireUser } from "@/lib/auth";
import { assembleContextPack } from "@/features/context/assemble";
import { CONTEXT_PACK_PROMPT_VERSION } from "@/lib/context-pack";
import type { ContextPackSeedType, ContextPackSize } from "@/types/domain";

export async function generateContextPackAction(input: {
  seedType: ContextPackSeedType;
  seedId: string;
  size: ContextPackSize;
  objective?: string;
}) {
  const { supabase, user } = await requireUser();
  const pack = await assembleContextPack({
    userId: user.id,
    seedType: input.seedType,
    seedId: input.seedId,
    size: input.size,
    objective: input.objective,
  });
  const { data } = await supabase
    .from("context_packs")
    .insert({
      user_id: user.id,
      seed_type: input.seedType,
      seed_id: input.seedId,
      size: input.size,
      objective: input.objective ?? null,
      selected_sources: pack.included.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        layer: item.layer,
        whyIncluded: item.whyIncluded,
      })),
      token_estimate: pack.tokenEstimate,
      prompt_version: CONTEXT_PACK_PROMPT_VERSION,
      markdown: pack.markdown,
    })
    .select("id")
    .single();
  return {
    markdown: pack.markdown,
    tokenEstimate: pack.tokenEstimate,
    included: pack.included,
    truncated: pack.truncated,
    id: data?.id ?? null,
  };
}

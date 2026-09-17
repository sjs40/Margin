"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/env";
import { syncSecTickerUniverse } from "@/lib/sec-tickers";
import { estimateKnowledgeBackfill, runKnowledgeBackfillBatch } from "@/ai/pipeline/backfill";

export async function setHostedAiEnabled(enabled: boolean) {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) return { error: "Unauthorized" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      hosted_ai_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function triggerSecTickerSync() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) return { error: "Unauthorized" };
  try {
    const result = await syncSecTickerUniverse({ force: true });
    revalidatePath("/admin");
    return { ok: true as const, ...result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Sync failed." };
  }
}

export async function dryRunKnowledgeBackfill() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) return { error: "Unauthorized" };
  const estimate = await estimateKnowledgeBackfill(user.id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_backfill_runs")
    .insert({
      user_id: user.id,
      status: "dry_run",
      dry_run: true,
      estimated_notes: estimate.remainingNotes,
      estimated_documents: estimate.remainingDocuments,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true as const, ...estimate, runId: data?.id };
}

export async function startKnowledgeBackfill() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) return { error: "Unauthorized" };
  const estimate = await estimateKnowledgeBackfill(user.id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_backfill_runs")
    .insert({
      user_id: user.id,
      status: "running",
      dry_run: false,
      estimated_notes: estimate.remainingNotes,
      estimated_documents: estimate.remainingDocuments,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not start backfill." };
  const result = await runKnowledgeBackfillBatch(user.id, data.id);
  revalidatePath("/admin");
  revalidatePath("/research/knowledge");
  return { ok: true as const, runId: data.id, ...estimate, ...result };
}

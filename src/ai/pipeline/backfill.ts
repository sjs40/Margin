import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { loadExistingKnowledgeLines, persistExtractedKnowledge } from "@/ai/pipeline/knowledge";
import { formatThemePromptLine } from "@/lib/theme-resolution";
import { asAliasList } from "@/lib/tickers";
import { withUserAi } from "@/lib/ai-credentials";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 5;

export async function estimateKnowledgeBackfill(userId: string) {
  const supabase = createAdminClient();
  const { data: notes } = await supabase
    .from("notes")
    .select("id")
    .eq("user_id", userId)
    .eq("processing_status", "ready");
  const { data: documents } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("processing_status", "ready");
  const { data: sourced } = await supabase
    .from("knowledge_object_sources")
    .select("source_type, source_id")
    .eq("user_id", userId)
    .eq("role", "origin")
    .in("source_type", ["note", "document"]);
  const done = new Set((sourced ?? []).map((row) => `${row.source_type}:${row.source_id}`));
  const remainingNotes = (notes ?? []).filter((row) => !done.has(`note:${row.id}`)).length;
  const remainingDocuments = (documents ?? []).filter((row) => !done.has(`document:${row.id}`)).length;
  return {
    notes: notes?.length ?? 0,
    documents: documents?.length ?? 0,
    remainingNotes,
    remainingDocuments,
  };
}

export async function runKnowledgeBackfillBatch(userId: string, runId: string) {
  const supabase = createAdminClient();
  const { data: run } = await supabase
    .from("knowledge_backfill_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .single();
  if (!run || run.dry_run) return { done: true, processed: 0, proposed: 0, skipped: 0 };

  const noteCursor = run.cursor_note_captured_at ?? "1970-01-01T00:00:00.000Z";
  const documentCursor = run.cursor_document_captured_at ?? "1970-01-01T00:00:00.000Z";
  const { data: notes } = await supabase
    .from("notes")
    .select("id, raw_text, interpreted_text, captured_at")
    .eq("user_id", userId)
    .eq("processing_status", "ready")
    .gt("captured_at", noteCursor)
    .order("captured_at", { ascending: true })
    .limit(BATCH_SIZE);
  const { data: documents } = await supabase
    .from("documents")
    .select("id, raw_content, interpreted_content, captured_at")
    .eq("user_id", userId)
    .eq("processing_status", "ready")
    .gt("captured_at", documentCursor)
    .order("captured_at", { ascending: true })
    .limit(BATCH_SIZE);

  let processed = 0;
  let proposed = 0;
  let skipped = 0;
  const { data: themes } = await supabase
    .from("themes")
    .select("name, aliases")
    .eq("user_id", userId)
    .eq("status", "active");
  const themeLines = (themes ?? []).map((theme) =>
    formatThemePromptLine({ name: theme.name, aliases: asAliasList(theme.aliases) }),
  );
  const existingKnowledge = await loadExistingKnowledgeLines(userId);

  const bound = await withUserAi(userId, { consume: true }, async () => {
    for (const note of notes ?? []) {
      const source = note.interpreted_text || note.raw_text || "";
      if (!source.trim()) {
        skipped += 1;
        processed += 1;
        continue;
      }
      const parsed = await ai.parseNote(source, themeLines, [], [], existingKnowledge);
      const result = await persistExtractedKnowledge({
        userId,
        noteId: note.id,
        origin: "backfill",
        entityIds: [],
        themeIds: [],
        claimIds: [],
        candidateInsights: parsed.data.candidateInsights ?? [],
        candidateFrameworks: parsed.data.candidateFrameworks ?? [],
      });
      processed += 1;
      proposed += result.created;
      if (result.skipped) skipped += 1;
    }
    for (const document of documents ?? []) {
      const source = document.interpreted_content || document.raw_content || "";
      if (!source.trim()) {
        skipped += 1;
        processed += 1;
        continue;
      }
      const parsed = await ai.parseAIImport(source, themeLines, existingKnowledge);
      const result = await persistExtractedKnowledge({
        userId,
        documentId: document.id,
        origin: "backfill",
        entityIds: [],
        themeIds: [],
        claimIds: [],
        candidateInsights: parsed.data.candidateInsights ?? [],
        candidateFrameworks: parsed.data.candidateFrameworks ?? [],
      });
      processed += 1;
      proposed += result.created;
      if (result.skipped) skipped += 1;
    }
  });
  if (!bound.ok) {
    logger.warn("knowledge_backfill_ai_skipped", { reason: bound.reason });
  }
  const lastNote = (notes ?? []).at(-1);
  const lastDocument = (documents ?? []).at(-1);
  const finished = (notes ?? []).length + (documents ?? []).length === 0;
  await supabase
    .from("knowledge_backfill_runs")
    .update({
      status: finished ? "completed" : "running",
      processed_count: Number(run.processed_count ?? 0) + processed,
      proposed_count: Number(run.proposed_count ?? 0) + proposed,
      skipped_count: Number(run.skipped_count ?? 0) + skipped,
      cursor_note_captured_at: lastNote?.captured_at ?? run.cursor_note_captured_at,
      cursor_note_id: lastNote?.id ?? run.cursor_note_id,
      cursor_document_captured_at: lastDocument?.captured_at ?? run.cursor_document_captured_at,
      cursor_document_id: lastDocument?.id ?? run.cursor_document_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
  return { done: finished, processed, proposed, skipped };
}

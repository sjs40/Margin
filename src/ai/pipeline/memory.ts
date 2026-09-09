import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { completeJob, startJob } from "@/ai/jobs";
import { dailyKey, endOfDayIso, startOfDayIso } from "@/lib/dates";
import { retrievalLimits } from "@/lib/env";
import { logger } from "@/lib/logger";

function formatNote(note: {
  id: string;
  captured_at: string;
  title: string | null;
  interpreted_text: string | null;
  raw_text: string | null;
}) {
  return `[${note.captured_at}] (${note.id}) ${note.title ?? ""}\n${note.interpreted_text ?? note.raw_text ?? ""}`;
}

async function nextVersion(metaNoteId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("meta_note_versions")
    .select("version_number")
    .eq("meta_note_id", metaNoteId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_number ?? 0) + 1;
}

async function writeMetaVersion(input: {
  metaNoteId: string;
  content: string;
  changeSummary: string;
  sourceNoteIds: string[];
}) {
  const supabase = createAdminClient();
  const version = await nextVersion(input.metaNoteId);
  await supabase.from("meta_note_versions").insert({
    meta_note_id: input.metaNoteId,
    version_number: version,
    content: input.content,
    change_summary: input.changeSummary,
    source_note_ids: input.sourceNoteIds,
  });
}

export async function upsertDailyMetaNote(userId: string, date = new Date()) {
  const supabase = createAdminClient();
  const day = dailyKey(date);
  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, interpreted_text, raw_text, captured_at")
    .eq("user_id", userId)
    .gte("captured_at", startOfDayIso(date))
    .lte("captured_at", endOfDayIso(date))
    .order("captured_at", { ascending: true });
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, interpreted_content, raw_content, captured_at")
    .eq("user_id", userId)
    .gte("captured_at", startOfDayIso(date))
    .lte("captured_at", endOfDayIso(date));

  if ((!notes || notes.length === 0) && (!documents || documents.length === 0)) {
    return null;
  }

  const { data: existing } = await supabase
    .from("meta_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("meta_type", "daily")
    .eq("date", day)
    .maybeSingle();

  const material = [
    ...(notes ?? []).map(formatNote),
    ...(documents ?? []).map((doc) =>
      `[${doc.captured_at}] document ${doc.id} ${doc.title ?? ""}\n${doc.interpreted_content ?? doc.raw_content}`,
    ),
  ].join("\n\n");

  const jobId = await startJob({
    userId,
    jobType: "synthesize_day",
    objectType: "meta_note",
    objectId: existing?.id ?? userId,
    provider: "gemini",
  });

  try {
    const result = await ai.synthesizeDay({
      date: day,
      notes: material,
      existingDaily: existing?.current_content,
    });
    const payload = {
      user_id: userId,
      meta_type: "daily" as const,
      date: day,
      title: result.data.title,
      current_content: result.data.content,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = existing
      ? await supabase.from("meta_notes").update(payload).eq("id", existing.id).select("*").single()
      : await supabase.from("meta_notes").insert(payload).select("*").single();
    if (error || !saved) throw new Error(error?.message ?? "Failed to save daily meta note");
    await writeMetaVersion({
      metaNoteId: saved.id,
      content: result.data.content,
      changeSummary: result.data.changeSummary,
      sourceNoteIds: (notes ?? []).map((note) => note.id),
    });
    await completeJob(jobId, {
      status: "completed",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCost: result.estimatedCost,
      latencyMs: result.latencyMs,
    });
    await updateAffectedMemories(userId, result.data.affectedTickers, result.data.affectedThemes);
    return saved;
  } catch (error) {
    const message = error instanceof Error ? error.message : "daily synthesis failed";
    logger.error("daily_synthesis_failed", { userId });
    await completeJob(jobId, { status: "failed", errorMessage: message });
    throw error;
  }
}

async function relevantNotesForEntity(userId: string, entityId: string) {
  const supabase = createAdminClient();
  const { data: links } = await supabase
    .from("note_entities")
    .select("note_id")
    .eq("entity_id", entityId);
  const ids = (links ?? []).map((link) => link.note_id);
  if (ids.length === 0) return [];
  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, interpreted_text, raw_text, captured_at")
    .eq("user_id", userId)
    .in("id", ids)
    .order("captured_at", { ascending: false })
    .limit(retrievalLimits.recentNotes);
  return notes ?? [];
}

async function relevantNotesForTheme(userId: string, themeId: string) {
  const supabase = createAdminClient();
  const { data: links } = await supabase
    .from("note_themes")
    .select("note_id")
    .eq("theme_id", themeId);
  const ids = (links ?? []).map((link) => link.note_id);
  if (ids.length === 0) return [];
  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, interpreted_text, raw_text, captured_at")
    .eq("user_id", userId)
    .in("id", ids)
    .order("captured_at", { ascending: false })
    .limit(retrievalLimits.recentNotes);
  return notes ?? [];
}

export async function updateCompanyMeta(userId: string, entityId: string) {
  const supabase = createAdminClient();
  const { data: entity } = await supabase.from("entities").select("*").eq("id", entityId).single();
  if (!entity) return;
  const notes = await relevantNotesForEntity(userId, entityId);
  if (notes.length === 0) return;
  const { data: existing } = await supabase
    .from("meta_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("meta_type", "company")
    .eq("entity_id", entityId)
    .maybeSingle();
  const result = await ai.updateCompanyMemory({
    name: entity.canonical_name,
    ticker: entity.ticker,
    existing: existing?.current_content ?? null,
    userEdited: Boolean(existing?.user_edited),
    recent: notes.map(formatNote).join("\n\n"),
  });
  const payload = {
    user_id: userId,
    meta_type: "company" as const,
    entity_id: entityId,
    title: result.data.title || entity.ticker || entity.canonical_name,
    current_content: result.data.content,
    updated_at: new Date().toISOString(),
  };
  const { data: saved } = existing
    ? await supabase.from("meta_notes").update(payload).eq("id", existing.id).select("*").single()
    : await supabase.from("meta_notes").insert(payload).select("*").single();
  if (!saved) return;
  await writeMetaVersion({
    metaNoteId: saved.id,
    content: result.data.content,
    changeSummary: result.data.changeSummary,
    sourceNoteIds: notes.map((note) => note.id),
  });
  await ai.embed(result.data.content).then(async (embedded) => {
    await supabase.from("embeddings").upsert(
      {
        user_id: userId,
        source_type: "meta_note",
        source_id: saved.id,
        chunk_index: 0,
        content: result.data.content,
        embedding: embedded.values,
        metadata: { metaType: "company", entityId },
      },
      { onConflict: "user_id,source_type,source_id,chunk_index" },
    );
  });
}

export async function updateThemeMeta(userId: string, themeId: string) {
  const supabase = createAdminClient();
  const { data: theme } = await supabase.from("themes").select("*").eq("id", themeId).single();
  if (!theme) return;
  const notes = await relevantNotesForTheme(userId, themeId);
  if (notes.length === 0) return;
  const { data: existing } = await supabase
    .from("meta_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("meta_type", "theme")
    .eq("theme_id", themeId)
    .maybeSingle();
  const result = await ai.updateThemeMemory({
    name: theme.name,
    existing: existing?.current_content ?? null,
    userEdited: Boolean(existing?.user_edited),
    recent: notes.map(formatNote).join("\n\n"),
  });
  const payload = {
    user_id: userId,
    meta_type: "theme" as const,
    theme_id: themeId,
    title: result.data.title || theme.name,
    current_content: result.data.content,
    updated_at: new Date().toISOString(),
  };
  const { data: saved } = existing
    ? await supabase.from("meta_notes").update(payload).eq("id", existing.id).select("*").single()
    : await supabase.from("meta_notes").insert(payload).select("*").single();
  if (!saved) return;
  await writeMetaVersion({
    metaNoteId: saved.id,
    content: result.data.content,
    changeSummary: result.data.changeSummary,
    sourceNoteIds: notes.map((note) => note.id),
  });
}

async function updateAffectedMemories(
  userId: string,
  tickers: string[],
  themeNames: string[],
) {
  const supabase = createAdminClient();
  if (tickers.length) {
    const { data: entities } = await supabase
      .from("entities")
      .select("id, ticker")
      .in("ticker", tickers.map((ticker) => ticker.toUpperCase()));
    for (const entity of entities ?? []) {
      await updateCompanyMeta(userId, entity.id);
    }
  }
  if (themeNames.length) {
    const { data: themes } = await supabase
      .from("themes")
      .select("id, name")
      .eq("user_id", userId);
    for (const theme of themes ?? []) {
      if (themeNames.some((name) => name.toLowerCase() === theme.name.toLowerCase())) {
        await updateThemeMeta(userId, theme.id);
      }
    }
  }
}

export async function discoverAndInbox(userId: string) {
  const supabase = createAdminClient();
  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, interpreted_text, raw_text, captured_at")
    .eq("user_id", userId)
    .order("captured_at", { ascending: false })
    .limit(40);
  const { data: themes } = await supabase
    .from("themes")
    .select("name")
    .eq("user_id", userId)
    .eq("status", "active");
  if (!notes?.length) return;
  const result = await ai.discoverConnections({
    notes: notes.map(formatNote).join("\n\n"),
    existingThemes: (themes ?? []).map((theme) => theme.name),
  });
  for (const theme of result.data.emergingThemes) {
    await supabase.from("inbox_items").insert({
      user_id: userId,
      category: "suggested_theme",
      title: `Potential theme: ${theme.name}`,
      body: theme.rationale,
      payload: theme,
    });
  }
  return result.data;
}

export async function runNightlyIntelligence(userId: string, date = new Date()) {
  logger.info("nightly_intelligence_started", { userId });
  const daily = await upsertDailyMetaNote(userId, date);
  await discoverAndInbox(userId);
  logger.info("nightly_intelligence_completed", { userId });
  return daily;
}

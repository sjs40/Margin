import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { completeJob, startJob } from "@/ai/jobs";
import { CLAIM_CONFLICTS_PROMPT_VERSION } from "@/ai/prompts";
import { dailyKey, endOfDayIso, startOfDayIso } from "@/lib/dates";
import { retrievalLimits } from "@/lib/env";
import { logger } from "@/lib/logger";
import { filterValidConflicts } from "@/lib/claims";
import { formatResolvedThreads } from "@/lib/loose-ends";
import { getUserSettings } from "@/lib/user-settings";

type MemoryNote = {
  id: string;
  captured_at: string;
  title: string | null;
  interpreted_text: string | null;
  raw_text: string | null;
  annotations?: Array<{ text: string; created_at: string }>;
};

function formatNote(note: MemoryNote) {
  const body = `[${note.captured_at}] (${note.id}) ${note.title ?? ""}\n${note.interpreted_text ?? note.raw_text ?? ""}`;
  const extra = (note.annotations ?? [])
    .map((row) => `User annotation (${row.created_at.slice(0, 10)}): ${row.text}`)
    .join("\n");
  return extra ? `${body}\n${extra}` : body;
}

async function attachAnnotations(notes: MemoryNote[]): Promise<MemoryNote[]> {
  if (notes.length === 0) return notes;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("note_annotations")
    .select("note_id, text, created_at")
    .in(
      "note_id",
      notes.map((note) => note.id),
    )
    .order("created_at", { ascending: true });
  const byNote = new Map<string, Array<{ text: string; created_at: string }>>();
  for (const row of data ?? []) {
    const list = byNote.get(row.note_id) ?? [];
    list.push({ text: row.text, created_at: row.created_at });
    byNote.set(row.note_id, list);
  }
  return notes.map((note) => ({ ...note, annotations: byNote.get(note.id) ?? [] }));
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

  const annotatedNotes = await attachAnnotations(notes ?? []);
  const material = [
    ...annotatedNotes.map(formatNote),
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
      userEdited: Boolean(existing?.user_edited),
      resolvedQuestions: await loadResolvedThreads(userId) || undefined,
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
  return attachAnnotations(notes ?? []);
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
  return attachAnnotations(notes ?? []);
}

type ClaimSnippet = {
  id: string;
  claim_text: string;
  claim_type: string;
  created_at: string;
  note_id: string | null;
  notes?: { captured_at: string } | { captured_at: string }[] | null;
};

function claimDate(claim: ClaimSnippet): string {
  const note = Array.isArray(claim.notes) ? claim.notes[0] : claim.notes;
  return note?.captured_at ?? claim.created_at;
}

function formatClaimLine(claim: ClaimSnippet): string {
  return `[${claim.id}] ${claim.claim_type} (${claimDate(claim)}): ${claim.claim_text}`;
}

async function loadResolvedThreads(userId: string, entityId?: string) {
  const supabase = createAdminClient();
  let questions = supabase
    .from("questions")
    .select("question_text, resolution_comment, status")
    .eq("user_id", userId)
    .in("status", ["resolved", "dismissed"])
    .not("resolution_comment", "is", null);
  let followups = supabase
    .from("followups")
    .select("text, resolution_comment, status")
    .eq("user_id", userId)
    .in("status", ["completed", "dismissed"])
    .not("resolution_comment", "is", null);
  if (entityId) {
    questions = questions.eq("entity_id", entityId);
    followups = followups.eq("entity_id", entityId);
  }
  const [{ data: q }, { data: f }] = await Promise.all([questions, followups]);
  return formatResolvedThreads([
    ...(q ?? []).map((row) => ({ question: row.question_text, comment: row.resolution_comment })),
    ...(f ?? []).map((row) => ({ question: row.text, comment: row.resolution_comment })),
  ]);
}

async function loadActiveClaims(userId: string, entityId: string, limit: number, excludeNoteId?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("claims")
    .select("id, claim_text, claim_type, created_at, note_id, notes(captured_at)")
    .eq("user_id", userId)
    .eq("entity_id", entityId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (excludeNoteId) query = query.neq("note_id", excludeNoteId);
  const { data } = await query;
  return (data ?? []) as ClaimSnippet[];
}

export async function detectClaimConflicts(input: {
  userId: string;
  entityId: string;
  ticker: string | null;
  name: string;
  triggerNoteId: string;
}) {
  const settings = await getUserSettings(input.userId);
  if (!settings.contradictionDetectionEnabled) return;

  const supabase = createAdminClient();
  const { data: newRows } = await supabase
    .from("claims")
    .select("id, claim_text, claim_type, created_at, note_id, notes(captured_at)")
    .eq("user_id", input.userId)
    .eq("entity_id", input.entityId)
    .eq("note_id", input.triggerNoteId);
  const newClaims = (newRows ?? []) as ClaimSnippet[];
  if (newClaims.length === 0) return;

  const priorClaims = await loadActiveClaims(
    input.userId,
    input.entityId,
    settings.contradictionPriorClaimsLimit,
    input.triggerNoteId,
  );
  if (priorClaims.length === 0) return;

  const jobId = await startJob({
    userId: input.userId,
    jobType: "detect_claim_conflicts",
    objectType: "note",
    objectId: input.triggerNoteId,
    provider: "gemini",
    promptVersion: CLAIM_CONFLICTS_PROMPT_VERSION,
  });

  try {
    const result = await ai.detectClaimConflicts({
      ticker: input.ticker,
      name: input.name,
      newClaims: newClaims.map(formatClaimLine).join("\n"),
      priorClaims: priorClaims.map(formatClaimLine).join("\n"),
    });
    const valid = filterValidConflicts(
      result.data.conflicts,
      newClaims.map((claim) => claim.id),
      priorClaims.map((claim) => claim.id),
      settings.contradictionMinConfidence,
    );
    for (const conflict of valid) {
      const { data: relation, error } = await supabase
        .from("claim_relations")
        .upsert(
          {
            user_id: input.userId,
            claim_id: conflict.newClaimId,
            related_claim_id: conflict.priorClaimId,
            relation_type: conflict.relation,
            explanation: conflict.explanation,
            detected_by: "ai",
            user_status: "pending",
          },
          { onConflict: "claim_id,related_claim_id,relation_type" },
        )
        .select("id")
        .single();
      if (error || !relation) continue;
      if (conflict.relation !== "contradicts") continue;
      const newClaim = newClaims.find((claim) => claim.id === conflict.newClaimId);
      const priorClaim = priorClaims.find((claim) => claim.id === conflict.priorClaimId);
      await supabase.from("inbox_items").insert({
        user_id: input.userId,
        category: "contradiction",
        object_type: "claim_relation",
        object_id: relation.id,
        title: `New note contradicts prior view on ${input.ticker ?? input.name}`,
        body: conflict.explanation,
        payload: {
          relationType: conflict.relation,
          ticker: input.ticker,
          newClaim: {
            id: conflict.newClaimId,
            text: newClaim?.claim_text ?? "",
            date: newClaim ? claimDate(newClaim) : null,
            noteId: newClaim?.note_id ?? input.triggerNoteId,
          },
          priorClaim: {
            id: conflict.priorClaimId,
            text: priorClaim?.claim_text ?? "",
            date: priorClaim ? claimDate(priorClaim) : null,
            noteId: priorClaim?.note_id ?? null,
          },
        },
      });
    }
    await completeJob(jobId, {
      status: "completed",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCost: result.estimatedCost,
      latencyMs: result.latencyMs,
      diagnostics: { promptVersion: result.promptVersion, count: valid.length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "claim conflict detection failed";
    logger.warn("claim_conflict_detection_failed", { entityId: input.entityId });
    await completeJob(jobId, { status: "failed", errorMessage: message });
  }
}

export async function updateCompanyMeta(userId: string, entityId: string, triggerNoteId?: string) {
  const supabase = createAdminClient();
  const { data: entity } = await supabase.from("entities").select("*").eq("id", entityId).single();
  if (!entity) return;
  const notes = await relevantNotesForEntity(userId, entityId);
  if (notes.length === 0) return;
  const settings = await getUserSettings(userId);
  if (triggerNoteId) {
    await detectClaimConflicts({
      userId,
      entityId,
      ticker: entity.ticker,
      name: entity.canonical_name,
      triggerNoteId,
    });
  }
  const priorClaims = await loadActiveClaims(
    userId,
    entityId,
    settings.contradictionPriorClaimsLimit,
  );
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
    priorClaims: priorClaims.map(formatClaimLine).join("\n") || undefined,
    resolvedQuestions: (await loadResolvedThreads(userId, entityId)) || undefined,
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

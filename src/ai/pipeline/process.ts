import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { completeJob, startJob } from "@/ai/jobs";
import { StructuredOutputError } from "@/ai/aiService";
import { resolveCompanies } from "@/lib/entity-resolution";
import { normalizeThemeName, pickExistingTheme } from "@/lib/theme-resolution";
import { lookupTicker } from "@/lib/tickers";
import { chunkDocument } from "@/lib/chunking";
import { logger } from "@/lib/logger";
import { withUserAi } from "@/lib/ai-credentials";
import { estimateEmbeddingCost, roundCost } from "@/lib/cost";
import { prepareNoteLinks } from "@/features/links/sync";
import type { ParsedNote } from "@/ai/schemas/parsed-note";
import type { ParsedImport } from "@/ai/schemas/memory-update";

type Admin = ReturnType<typeof createAdminClient>;

async function themeNames(supabase: Admin, userId: string) {
  const { data } = await supabase
    .from("themes")
    .select("id, name, normalized_name, status")
    .eq("user_id", userId)
    .neq("status", "archived");
  return data ?? [];
}

async function upsertCompany(
  supabase: Admin,
  input: { ticker: string | null; canonicalName: string; aliases: string[] },
) {
  if (input.ticker) {
    const { data: existing } = await supabase
      .from("entities")
      .select("id")
      .eq("ticker", input.ticker)
      .maybeSingle();
    if (existing) return existing.id as string;
  }
  const { data: byName } = await supabase
    .from("entities")
    .select("id")
    .eq("entity_type", "company")
    .ilike("canonical_name", input.canonicalName)
    .maybeSingle();
  if (byName) return byName.id as string;

  const known = input.ticker ? lookupTicker(input.ticker) : undefined;
  const { data, error } = await supabase
    .from("entities")
    .insert({
      entity_type: "company",
      canonical_name: known?.name ?? input.canonicalName,
      ticker: input.ticker,
      exchange: known?.exchange ?? null,
      aliases: known?.aliases ?? input.aliases,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to upsert company");
  return data.id as string;
}

async function resolveThemesForUser(
  supabase: Admin,
  userId: string,
  proposed: Array<{ name: string; confidence: number }>,
) {
  const existing = await themeNames(supabase, userId);
  const linked: Array<{ id: string; name: string; confidence: number; created: boolean }> = [];
  for (const theme of proposed) {
    if (theme.confidence < 0.55) continue;
    const match = pickExistingTheme(theme.name, existing);
    if (match) {
      linked.push({ id: match.id, name: match.name, confidence: theme.confidence, created: false });
      continue;
    }
    if (theme.confidence < 0.8) {
      await supabase.from("inbox_items").insert({
        user_id: userId,
        category: "suggested_theme",
        title: `Suggested theme: ${theme.name}`,
        body: "This concept appeared in a note but was not automatically created.",
        payload: { name: theme.name, confidence: theme.confidence },
      });
      continue;
    }
    const { data, error } = await supabase
      .from("themes")
      .insert({
        user_id: userId,
        name: theme.name,
        normalized_name: normalizeThemeName(theme.name),
        status: "active",
      })
      .select("id, name")
      .single();
    if (error || !data) continue;
    existing.push({
      id: data.id,
      name: data.name,
      normalized_name: normalizeThemeName(theme.name),
      status: "active",
    });
    linked.push({ id: data.id, name: data.name, confidence: theme.confidence, created: true });
  }
  return linked;
}

async function storeParsedStructures(
  supabase: Admin,
  input: {
    userId: string;
    noteId?: string;
    documentId?: string;
    parsed: ParsedNote | ParsedImport;
    sourceText: string;
  },
) {
  const { resolved, ambiguous } = resolveCompanies(input.parsed.companies, input.sourceText);
  for (const company of resolved) {
    const entityId = await upsertCompany(supabase, company);
    if (input.noteId) {
      await supabase.from("note_entities").upsert(
        {
          note_id: input.noteId,
          entity_id: entityId,
          relationship_type: "mentioned",
          confidence: company.confidence,
        },
        { onConflict: "note_id,entity_id,relationship_type" },
      );
    }
    if (input.documentId) {
      await supabase.from("document_entities").upsert(
        {
          document_id: input.documentId,
          entity_id: entityId,
          relationship_type: "mentioned",
          confidence: company.confidence,
        },
        { onConflict: "document_id,entity_id,relationship_type" },
      );
    }
  }
  for (const company of ambiguous) {
    await supabase.from("inbox_items").insert({
      user_id: input.userId,
      category: "ambiguous_entity",
      title: `Is ${company.ticker} a ticker?`,
      body: company.reason,
      object_type: input.noteId ? "note" : "document",
      object_id: input.noteId ?? input.documentId,
      payload: company,
    });
  }

  const themes = await resolveThemesForUser(supabase, input.userId, input.parsed.themes);
  for (const theme of themes) {
    if (input.noteId) {
      await supabase.from("note_themes").upsert(
        {
          note_id: input.noteId,
          theme_id: theme.id,
          confidence: theme.confidence,
        },
        { onConflict: "note_id,theme_id" },
      );
    }
    if (input.documentId) {
      await supabase.from("document_themes").upsert(
        {
          document_id: input.documentId,
          theme_id: theme.id,
          confidence: theme.confidence,
        },
        { onConflict: "document_id,theme_id" },
      );
    }
  }

  if ("claims" in input.parsed) {
    for (const claim of input.parsed.claims) {
      await supabase.from("claims").insert({
        user_id: input.userId,
        note_id: input.noteId ?? null,
        document_id: input.documentId ?? null,
        claim_text: claim.text,
        claim_type: claim.type,
        confidence: claim.confidence,
      });
    }
  }
  for (const question of input.parsed.questions) {
    await supabase.from("questions").insert({
      user_id: input.userId,
      note_id: input.noteId ?? null,
      document_id: input.documentId ?? null,
      question_text: question,
      status: "open",
    });
  }
  for (const followUp of input.parsed.followUps) {
    await supabase.from("followups").insert({
      user_id: input.userId,
      note_id: input.noteId ?? null,
      document_id: input.documentId ?? null,
      text: followUp,
      status: "open",
    });
  }
  return { resolved, themes };
}

async function upsertEmbedding(
  supabase: Admin,
  input: {
    userId: string;
    sourceType: "note" | "document" | "meta_note";
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

export async function processTextNote(noteId: string) {
  const links = await prepareNoteLinks(noteId);
  const supabase = createAdminClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single();
  if (error || !note) return;

  const bound = await withUserAi(note.user_id, { consume: true }, async () => {
    await processTextNoteBound(supabase, note, noteId, links);
  });
  if (!bound.ok) {
    logger.warn("ai_skipped_unconfigured", { objectId: noteId, reason: bound.reason });
    revalidatePath("/");
    revalidatePath("/today");
    revalidatePath(`/notes/${noteId}`);
  }
}

async function processTextNoteBound(
  supabase: Admin,
  note: { user_id: string; raw_text: string | null },
  noteId: string,
  links: Awaited<ReturnType<typeof prepareNoteLinks>>,
) {
  await supabase.from("notes").update({ processing_status: "processing" }).eq("id", noteId);
  const jobId = await startJob({
    userId: note.user_id,
    jobType: "parse_note",
    objectType: "note",
    objectId: noteId,
    provider: "gemini",
  });

  try {
    const existing = await themeNames(supabase, note.user_id);
    const source = note.raw_text ?? "";
    const parsed = await ai.parseNote(
      source,
      existing.map((theme) => theme.name),
      links.map((link) => ({
        url: link.canonical_url ?? link.url,
        title: link.title,
        description: link.description,
      })),
    );
    await storeParsedStructures(supabase, {
      userId: note.user_id,
      noteId,
      parsed: parsed.data,
      sourceText: source,
    });
    await supabase
      .from("notes")
      .update({
        interpreted_text: parsed.data.cleanedText,
        title: parsed.data.title,
        note_kind: parsed.data.noteKind,
        ai_confidence: parsed.data.overallConfidence,
        processing_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId);
    await upsertEmbedding(supabase, {
      userId: note.user_id,
      sourceType: "note",
      sourceId: noteId,
      chunkIndex: 0,
      content: parsed.data.cleanedText || source,
      metadata: { noteKind: parsed.data.noteKind },
    });
    await completeJob(jobId, {
      status: "completed",
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      estimatedCost: parsed.estimatedCost,
      latencyMs: parsed.latencyMs,
      diagnostics: { promptVersion: parsed.promptVersion, model: parsed.model },
    });
    revalidatePath("/");
    revalidatePath("/today");
    revalidatePath(`/notes/${noteId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "parse failed";
    logger.error("note_processing_failed", { objectId: noteId });
    await supabase
      .from("notes")
      .update({ processing_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", noteId);
    await supabase.from("inbox_items").insert({
      user_id: note.user_id,
      category: "processing_failed",
      title: "Note processing failed",
      body: error instanceof StructuredOutputError ? "AI output was invalid after retry." : message,
      object_type: "note",
      object_id: noteId,
    });
    await completeJob(jobId, { status: "failed", errorMessage: message });
    revalidatePath("/");
    revalidatePath("/today");
    revalidatePath(`/notes/${noteId}`);
    revalidatePath("/inbox");
  }
}

export async function processHandwrittenNote(noteId: string) {
  const supabase = createAdminClient();
  const { data: note } = await supabase.from("notes").select("*").eq("id", noteId).single();
  if (!note?.source_asset_id) return;
  const { data: asset } = await supabase
    .from("source_assets")
    .select("*")
    .eq("id", note.source_asset_id)
    .single();
  if (!asset) return;

  const bound = await withUserAi(note.user_id, { consume: true }, async () => {
    await processHandwrittenNoteBound(supabase, note, asset, noteId);
  });
  if (!bound.ok) {
    logger.warn("ai_skipped_unconfigured", { objectId: noteId, reason: bound.reason });
  }
}

async function processHandwrittenNoteBound(
  supabase: Admin,
  note: { user_id: string; source_asset_id: string },
  asset: { storage_path: string; mime_type: string | null },
  noteId: string,
) {
  await supabase.from("notes").update({ processing_status: "processing" }).eq("id", noteId);
  const jobId = await startJob({
    userId: note.user_id,
    jobType: "interpret_handwriting",
    objectType: "note",
    objectId: noteId,
    provider: "gemini",
  });

  try {
    const { data: file, error } = await supabase.storage
      .from("source-assets")
      .download(asset.storage_path);
    if (error || !file) throw new Error(error?.message ?? "Missing source image");
    const buffer = Buffer.from(await file.arrayBuffer());
    const interpreted = await ai.interpretHandwriting({
      mimeType: asset.mime_type ?? "image/jpeg",
      dataBase64: buffer.toString("base64"),
    });
    const needsReview =
      interpreted.data.confidence < 0.7 || interpreted.data.uncertainSegments.length > 0;
    await supabase
      .from("notes")
      .update({
        literal_transcription: interpreted.data.literalTranscription,
        interpreted_text: interpreted.data.interpretedText,
        raw_text: interpreted.data.literalTranscription,
        original_raw_text: interpreted.data.literalTranscription,
        uncertain_segments: interpreted.data.uncertainSegments,
        ai_confidence: interpreted.data.confidence,
        processing_status: needsReview ? "needs_review" : "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId);
    if (needsReview) {
      await supabase.from("inbox_items").insert({
        user_id: note.user_id,
        category: "needs_interpretation",
        title: "Handwriting needs review",
        object_type: "note",
        object_id: noteId,
        payload: interpreted.data,
      });
    }
    await completeJob(jobId, {
      status: "completed",
      inputTokens: interpreted.inputTokens,
      outputTokens: interpreted.outputTokens,
      estimatedCost: interpreted.estimatedCost,
      latencyMs: interpreted.latencyMs,
      diagnostics: { promptVersion: interpreted.promptVersion },
    });
    await processTextNote(noteId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "handwriting failed";
    await supabase.from("notes").update({ processing_status: "failed" }).eq("id", noteId);
    await supabase.from("inbox_items").insert({
      user_id: note.user_id,
      category: "processing_failed",
      title: "Handwriting processing failed",
      object_type: "note",
      object_id: noteId,
    });
    await completeJob(jobId, { status: "failed", errorMessage: message });
  }
}

export async function processDocument(documentId: string) {
  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (!document) return;

  const bound = await withUserAi(document.user_id, { consume: true }, async () => {
    await processDocumentBound(supabase, document, documentId);
  });
  if (!bound.ok) {
    logger.warn("ai_skipped_unconfigured", { objectId: documentId, reason: bound.reason });
  }
}

async function processDocumentBound(
  supabase: Admin,
  document: { user_id: string; raw_content: string },
  documentId: string,
) {
  await supabase
    .from("documents")
    .update({ processing_status: "processing" })
    .eq("id", documentId);
  const jobId = await startJob({
    userId: document.user_id,
    jobType: "parse_ai_import",
    objectType: "document",
    objectId: documentId,
    provider: "gemini",
  });
  try {
    const existing = await themeNames(supabase, document.user_id);
    const parsed = await ai.parseAIImport(
      document.raw_content,
      existing.map((theme) => theme.name),
    );
    await storeParsedStructures(supabase, {
      userId: document.user_id,
      documentId,
      parsed: parsed.data,
      sourceText: document.raw_content,
    });
    await supabase
      .from("documents")
      .update({
        title: parsed.data.title,
        document_type: parsed.data.documentType,
        interpreted_content: parsed.data.cleanedMarkdown,
        processing_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);
    const chunks = chunkDocument(parsed.data.cleanedMarkdown || document.raw_content);
    for (const chunk of chunks) {
      await upsertEmbedding(supabase, {
        userId: document.user_id,
        sourceType: "document",
        sourceId: documentId,
        chunkIndex: chunk.index,
        content: chunk.content,
        metadata: { heading: chunk.heading, title: parsed.data.title },
      });
    }
    await completeJob(jobId, {
      status: "completed",
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      estimatedCost: parsed.estimatedCost,
      latencyMs: parsed.latencyMs,
      diagnostics: { promptVersion: parsed.promptVersion },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "import failed";
    await supabase.from("documents").update({ processing_status: "failed" }).eq("id", documentId);
    await supabase.from("inbox_items").insert({
      user_id: document.user_id,
      category: "processing_failed",
      title: "Import processing failed",
      object_type: "document",
      object_id: documentId,
    });
    await completeJob(jobId, { status: "failed", errorMessage: message });
  }
}

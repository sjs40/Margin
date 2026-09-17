"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { normalizeThemeName } from "@/lib/theme-resolution";
import {
  buildLooseEndInboxInsert,
  findOpenLooseEndInboxItem,
  followupStatusForAction,
  LOOSE_END_SELECT,
  mapFollowupRecord,
  mapQuestionRecord,
  questionStatusForAction,
  type FollowupRecord,
  type FollowupStatus,
  type LooseEndActionStatus,
  type LooseEndKind,
  type QuestionRecord,
  type QuestionStatus,
} from "@/lib/loose-ends";

export type { LooseEndKind };

function inboxStatusAfterLooseEndAction(status: LooseEndActionStatus): "resolved" | "dismissed" | null {
  switch (status) {
    case "open":
    case "deferred":
      return null;
    case "dismissed":
      return "dismissed";
    case "resolved":
    case "completed":
      return "resolved";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function revalidateLooseEndSurfaces(extra?: {
  noteId?: string | null;
  documentId?: string | null;
  entityId?: string | null;
  themeId?: string | null;
}) {
  revalidatePath("/today");
  revalidatePath("/research");
  revalidatePath("/research/loose-ends");
  revalidatePath("/inbox");
  revalidatePath("/notes");
  if (extra?.noteId) revalidatePath(`/notes/${extra.noteId}`);
  if (extra?.documentId) revalidatePath(`/documents/${extra.documentId}`);
  if (extra?.entityId) revalidatePath(`/research/companies/${extra.entityId}`);
  if (extra?.themeId) revalidatePath(`/research/themes/${extra.themeId}`);
}

export async function updateLooseEnd(input: {
  id: string;
  kind: LooseEndKind;
  status: LooseEndActionStatus;
  comment?: string;
  resolvedByNoteId?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();
  const comment = input.comment?.trim() || null;
  let noteId: string | null = null;
  let documentId: string | null = null;
  let entityId: string | null = null;
  let themeId: string | null = null;
  switch (input.kind) {
    case "question": {
      const status = questionStatusForAction(input.status);
      const fields: {
        status: QuestionStatus;
        updated_at: string;
        resolved_at: string | null;
        resolution_comment?: string | null;
        resolved_by_note_id?: string | null;
      } = {
        status,
        updated_at: now,
        resolved_at: status === "resolved" ? now : null,
      };
      if (input.comment !== undefined) fields.resolution_comment = comment;
      if (input.resolvedByNoteId !== undefined) fields.resolved_by_note_id = input.resolvedByNoteId;
      const { data, error } = await supabase
        .from("questions")
        .update(fields)
        .eq("id", input.id)
        .eq("user_id", user.id)
        .select("note_id, document_id, entity_id, theme_id")
        .maybeSingle();
      if (error) return { error: error.message };
      noteId = data?.note_id ?? null;
      documentId = data?.document_id ?? null;
      entityId = data?.entity_id ?? null;
      themeId = data?.theme_id ?? null;
      break;
    }
    case "followup": {
      const status = followupStatusForAction(input.status);
      const fields: {
        status: FollowupStatus;
        updated_at: string;
        completed_at: string | null;
        resolution_comment?: string | null;
        resolved_by_note_id?: string | null;
      } = {
        status,
        updated_at: now,
        completed_at: status === "completed" ? now : null,
      };
      if (input.comment !== undefined) fields.resolution_comment = comment;
      if (input.resolvedByNoteId !== undefined) fields.resolved_by_note_id = input.resolvedByNoteId;
      const { data, error } = await supabase
        .from("followups")
        .update(fields)
        .eq("id", input.id)
        .eq("user_id", user.id)
        .select("note_id, document_id, entity_id, theme_id")
        .maybeSingle();
      if (error) return { error: error.message };
      noteId = data?.note_id ?? null;
      documentId = data?.document_id ?? null;
      entityId = data?.entity_id ?? null;
      themeId = data?.theme_id ?? null;
      break;
    }
    default: {
      const exhaustive: never = input.kind;
      return { error: `Unhandled Loose End kind: ${exhaustive}` };
    }
  }
  const closedStatus = inboxStatusAfterLooseEndAction(input.status);
  if (closedStatus) {
    await supabase
      .from("inbox_items")
      .update({ status: closedStatus, updated_at: now })
      .eq("user_id", user.id)
      .eq("category", "loose_end")
      .eq("object_type", input.kind)
      .eq("object_id", input.id)
      .eq("status", "open");
  }
  revalidateLooseEndSurfaces({ noteId, documentId, entityId, themeId });
  return { ok: true };
}

export async function sendLooseEndToInbox(input: { id: string; kind: LooseEndKind }) {
  const { supabase, user } = await requireUser();
  let table: "questions" | "followups";
  switch (input.kind) {
    case "question":
      table = "questions";
      break;
    case "followup":
      table = "followups";
      break;
    default: {
      const exhaustive: never = input.kind;
      return { error: `Unhandled Loose End kind: ${exhaustive}` };
    }
  }
  const { data: row, error: loadError } = await supabase
    .from(table)
    .select(LOOSE_END_SELECT)
    .eq("id", input.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Loose End not found." };

  const view =
    input.kind === "question"
      ? mapQuestionRecord(row as QuestionRecord)
      : mapFollowupRecord(row as FollowupRecord);
  if (view.status !== "open" && view.status !== "deferred") {
    return { error: "Only open Loose Ends can be sent to Inbox." };
  }

  const { data: existingRows } = await supabase
    .from("inbox_items")
    .select("id, category, object_type, object_id, status")
    .eq("user_id", user.id)
    .eq("category", "loose_end")
    .eq("object_type", input.kind)
    .eq("object_id", input.id)
    .eq("status", "open");
  if (!findOpenLooseEndInboxItem(existingRows ?? [], input.kind, input.id)) {
    const insert = buildLooseEndInboxInsert({
      userId: user.id,
      kind: input.kind,
      looseEndId: input.id,
      text: view.text,
      noteId: view.note_id,
      documentId: view.document_id,
      entityId: view.entity_id,
      themeId: view.theme_id,
      sourceTitle: view.source_title,
      entityLabel: view.entity_label,
      themeName: view.theme_name,
    });
    const { error: insertError } = await supabase.from("inbox_items").insert(insert);
    if (insertError && insertError.code !== "23505") return { error: insertError.message };
  }

  if (view.status === "open") {
    const deferred = await updateLooseEnd({
      id: input.id,
      kind: input.kind,
      status: "deferred",
    });
    if (deferred.error) return deferred;
  }

  revalidateLooseEndSurfaces({
    noteId: view.note_id,
    documentId: view.document_id,
    entityId: view.entity_id,
    themeId: view.theme_id,
  });
  return { ok: true };
}

export async function actOnLooseEndInboxItem(input: {
  inboxItemId: string;
  action: "return" | "resolve" | "dismiss";
  comment?: string;
  resolvedByNoteId?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("id", input.inboxItemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return { error: "Inbox item not found." };
  if (item.category !== "loose_end") return { error: "Not a Loose End inbox item." };
  if (item.object_type !== "question" && item.object_type !== "followup") {
    return { error: "Inbox item is missing its Loose End." };
  }
  const kind: LooseEndKind = item.object_type;
  if (!item.object_id) return { error: "Inbox item is missing its Loose End." };

  let nextStatus: LooseEndActionStatus;
  switch (input.action) {
    case "return":
      nextStatus = "open";
      break;
    case "resolve":
      nextStatus = kind === "followup" ? "completed" : "resolved";
      break;
    case "dismiss":
      nextStatus = "dismissed";
      break;
    default: {
      const exhaustive: never = input.action;
      return { error: `Unhandled inbox action: ${exhaustive}` };
    }
  }

  const updated = await updateLooseEnd({
    id: item.object_id,
    kind,
    status: nextStatus,
    ...(input.action === "return"
      ? {}
      : {
          comment: input.comment,
          resolvedByNoteId: input.action === "resolve" ? (input.resolvedByNoteId ?? null) : null,
        }),
  });
  if (updated.error) return updated;

  const inboxStatus = input.action === "dismiss" ? "dismissed" : "resolved";
  const { error } = await supabase
    .from("inbox_items")
    .update({ status: inboxStatus, updated_at: new Date().toISOString() })
    .eq("id", input.inboxItemId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/inbox");
  revalidatePath("/today");
  revalidatePath("/research");
  revalidatePath("/research/loose-ends");
  return { ok: true };
}

export async function createLooseEnd(input: {
  kind: LooseEndKind;
  text: string;
  noteId?: string | null;
  entityId?: string | null;
  themeId?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const text = input.text.trim();
  if (!text) return { error: "Write something first." };
  if (input.kind === "question") {
    const { error } = await supabase.from("questions").insert({
      user_id: user.id,
      note_id: input.noteId ?? null,
      entity_id: input.entityId ?? null,
      theme_id: input.themeId ?? null,
      question_text: text,
      status: "open",
      source: "user",
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("followups").insert({
      user_id: user.id,
      note_id: input.noteId ?? null,
      entity_id: input.entityId ?? null,
      theme_id: input.themeId ?? null,
      text,
      status: "open",
      source: "user",
    });
    if (error) return { error: error.message };
  }
  revalidatePath("/today");
  revalidatePath("/research");
  revalidatePath("/research/loose-ends");
  if (input.noteId) revalidatePath(`/notes/${input.noteId}`);
  return { ok: true };
}

export async function searchRecentNotes(query: string) {
  const { supabase, user } = await requireUser();
  const q = query.trim();
  let request = supabase
    .from("notes")
    .select("id, title, captured_at")
    .eq("user_id", user.id)
    .order("captured_at", { ascending: false })
    .limit(8);
  if (q) request = request.ilike("title", `%${q}%`);
  const { data } = await request;
  return data ?? [];
}

export async function mergeThemes(sourceId: string, targetId: string) {
  const { supabase, user } = await requireUser();
  if (!sourceId || !targetId || sourceId === targetId) return { error: "Pick two different themes." };
  const { error } = await supabase.rpc("merge_themes", {
    source: sourceId,
    target: targetId,
    owner: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/research");
  revalidatePath(`/research/themes/${sourceId}`);
  revalidatePath(`/research/themes/${targetId}`);
  revalidatePath("/inbox");
  return { ok: true, targetId };
}

export async function mergeSuggestedTheme(name: string, targetId: string) {
  const { supabase, user } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed || !targetId) return { error: "Pick a theme to merge into." };
  const { data: created, error: createError } = await supabase
    .from("themes")
    .insert({
      user_id: user.id,
      name: trimmed,
      normalized_name: normalizeThemeName(trimmed),
      status: "active",
    })
    .select("id")
    .single();
  if (createError || !created) {
    const { data: existing } = await supabase
      .from("themes")
      .select("id")
      .eq("user_id", user.id)
      .eq("normalized_name", normalizeThemeName(trimmed))
      .maybeSingle();
    if (!existing) return { error: createError?.message ?? "Could not create suggested theme." };
    return mergeThemes(existing.id, targetId);
  }
  return mergeThemes(created.id, targetId);
}

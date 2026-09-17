"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { normalizeThemeName } from "@/lib/theme-resolution";

export type LooseEndKind = "question" | "followup";

export async function updateLooseEnd(input: {
  id: string;
  kind: LooseEndKind;
  status: "open" | "resolved" | "dismissed" | "completed" | "deferred";
  comment?: string;
  resolvedByNoteId?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();
  const comment = input.comment?.trim() || null;
  if (input.kind === "question") {
    const status =
      input.status === "completed" ? "resolved" : input.status;
    const { error } = await supabase
      .from("questions")
      .update({
        status,
        resolution_comment: comment,
        resolved_by_note_id: input.resolvedByNoteId ?? null,
        resolved_at: status === "resolved" ? now : null,
        updated_at: now,
      })
      .eq("id", input.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const status = input.status === "resolved" ? "completed" : input.status;
    const { error } = await supabase
      .from("followups")
      .update({
        status,
        resolution_comment: comment,
        resolved_by_note_id: input.resolvedByNoteId ?? null,
        completed_at: status === "completed" ? now : null,
        updated_at: now,
      })
      .eq("id", input.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }
  if (input.status !== "deferred") {
    await supabase
      .from("inbox_items")
      .update({ status: "resolved", updated_at: now })
      .eq("user_id", user.id)
      .eq("category", "loose_end")
      .eq("object_type", input.kind)
      .eq("object_id", input.id)
      .eq("status", "open");
  }
  revalidatePath("/today");
  revalidatePath("/research");
  revalidatePath("/research/loose-ends");
  revalidatePath("/inbox");
  revalidatePath("/notes");
  return { ok: true };
}

export async function sendLooseEndToInbox(input: { id: string; kind: LooseEndKind }) {
  const { supabase, user } = await requireUser();
  const table = input.kind === "question" ? "questions" : "followups";
  const { data: existing } = await supabase
    .from(table)
    .select("*")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "Not found." };
  const now = new Date().toISOString();
  if (input.kind === "question") {
    await supabase
      .from("questions")
      .update({ status: "deferred", updated_at: now })
      .eq("id", input.id)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("followups")
      .update({ status: "deferred", updated_at: now })
      .eq("id", input.id)
      .eq("user_id", user.id);
  }
  const title = input.kind === "question" ? existing.question_text : existing.text;
  const { data: openItem } = await supabase
    .from("inbox_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("category", "loose_end")
    .eq("object_type", input.kind)
    .eq("object_id", input.id)
    .eq("status", "open")
    .maybeSingle();
  if (!openItem) {
    await supabase.from("inbox_items").insert({
      user_id: user.id,
      category: "loose_end",
      title: String(title),
      body: "Deferred from Loose Ends.",
      object_type: input.kind,
      object_id: input.id,
      payload: { kind: input.kind },
      status: "open",
    });
  }
  revalidatePath("/today");
  revalidatePath("/research/loose-ends");
  revalidatePath("/inbox");
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

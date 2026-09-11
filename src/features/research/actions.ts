"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export type LooseEndKind = "question" | "followup";

export async function updateLooseEnd(input: {
  id: string;
  kind: LooseEndKind;
  status: "open" | "resolved" | "dismissed" | "completed";
  comment?: string;
  resolvedByNoteId?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();
  const comment = input.comment?.trim() || null;
  if (input.kind === "question") {
    const status = input.status === "completed" ? "resolved" : input.status;
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
  revalidatePath("/today");
  revalidatePath("/research");
  revalidatePath("/research/loose-ends");
  revalidatePath("/notes");
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

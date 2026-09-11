"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { reembedNoteWithAnnotations } from "@/ai/pipeline/process";

async function touchNote(noteId: string) {
  revalidatePath(`/notes/${noteId}`);
  revalidatePath("/");
  revalidatePath("/today");
  after(async () => {
    await reembedNoteWithAnnotations(noteId);
  });
}

export async function createNoteAnnotation(input: {
  noteId: string;
  text: string;
  parentAnnotationId?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const text = input.text.trim();
  if (!text) return { error: "Write an annotation first." };
  const { error } = await supabase.from("note_annotations").insert({
    user_id: user.id,
    note_id: input.noteId,
    parent_annotation_id: input.parentAnnotationId ?? null,
    text,
  });
  if (error) return { error: error.message };
  await touchNote(input.noteId);
  return { ok: true };
}

export async function updateNoteAnnotation(id: string, text: string) {
  const { supabase, user } = await requireUser();
  const trimmed = text.trim();
  if (!trimmed) return { error: "Annotation cannot be empty." };
  const { data, error } = await supabase
    .from("note_annotations")
    .update({ text: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("note_id")
    .single();
  if (error || !data) return { error: error?.message ?? "Not found." };
  await touchNote(data.note_id);
  return { ok: true };
}

export async function deleteNoteAnnotation(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("note_annotations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("note_id")
    .single();
  if (error || !data) return { error: error?.message ?? "Not found." };
  await touchNote(data.note_id);
  return { ok: true };
}

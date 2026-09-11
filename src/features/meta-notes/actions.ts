"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function saveMetaNoteEdit(id: string, content: string) {
  const { supabase, user } = await requireUser();
  const { data: existing, error: loadError } = await supabase
    .from("meta_notes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (loadError || !existing) return { error: loadError?.message ?? "Meta note not found." };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("meta_notes")
    .update({
      current_content: content,
      user_edited: true,
      updated_at: now,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  const { data: latest } = await supabase
    .from("meta_note_versions")
    .select("version_number")
    .eq("meta_note_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: versionError } = await supabase.from("meta_note_versions").insert({
    meta_note_id: id,
    version_number: (latest?.version_number ?? 0) + 1,
    content,
    change_summary: "User edit",
    source_note_ids: [],
  });
  if (versionError) return { error: versionError.message };
  revalidatePath("/today");
  revalidatePath("/research");
  return { ok: true };
}

"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { processDocument, processHandwrittenNote, processTextNote } from "@/ai/pipeline/process";
import { upsertDailyMetaNote } from "@/ai/pipeline/memory";
import { parseImportedMarkdown } from "@/lib/importer";

export async function createTextNote(rawText: string, sourceType: "typed" | "dictated" | "longform" = "typed") {
  const text = rawText.trim();
  if (!text) return { error: "Note is empty." };
  const { supabase, user } = await requireUser();
  await supabase.from("users").upsert({ id: user.id, email: user.email });
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      source_type: sourceType,
      raw_text: text,
      original_raw_text: text,
      processing_status: "pending",
      note_kind: text.length > 800 ? "thinking" : "quick",
    })
    .select("*")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save note." };
  after(async () => {
    await processTextNote(data.id);
  });
  revalidatePath("/");
  revalidatePath("/today");
  return { note: data };
}

export async function updateNoteText(noteId: string, rawText: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notes")
    .update({ raw_text: rawText, processing_status: "pending", updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  after(async () => {
    await processTextNote(noteId);
  });
  revalidatePath(`/notes/${noteId}`);
  return { ok: true };
}

export async function retryNote(noteId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("notes")
    .select("source_type")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .single();
  if (!data) return { error: "Note not found." };
  after(async () => {
    if (data.source_type === "handwritten_image") await processHandwrittenNote(noteId);
    else await processTextNote(noteId);
  });
  revalidatePath(`/notes/${noteId}`);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function createHandwrittenNote(formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo of the page." };
  }
  const path = `${user.id}/${crypto.randomUUID()}-${file.name || "page.jpg"}`;
  const { error: uploadError } = await supabase.storage
    .from("source-assets")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { data: asset, error: assetError } = await supabase
    .from("source_assets")
    .insert({
      user_id: user.id,
      asset_type: "handwritten_image",
      storage_path: path,
      mime_type: file.type || "image/jpeg",
      original_filename: file.name,
    })
    .select("id")
    .single();
  if (assetError || !asset) return { error: assetError?.message ?? "Could not store asset." };

  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      source_type: "handwritten_image",
      raw_text: "",
      original_raw_text: "",
      title: "Handwritten page",
      processing_status: "pending",
      source_asset_id: asset.id,
    })
    .select("*")
    .single();
  if (error || !note) return { error: error?.message ?? "Could not save note." };
  after(async () => {
    await processHandwrittenNote(note.id);
  });
  revalidatePath("/");
  return { note };
}

export async function importResearchDocument(raw: string) {
  const content = raw.trim();
  if (!content) return { error: "Paste a research note to import." };
  const { supabase, user } = await requireUser();
  const parsed = parseImportedMarkdown(content);
  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: parsed.title,
      document_type: parsed.documentType,
      raw_content: parsed.raw,
      source: parsed.source,
      processing_status: "pending",
    })
    .select("*")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not import document." };
  after(async () => {
    await processDocument(data.id);
  });
  revalidatePath("/research");
  revalidatePath("/");
  return { document: data };
}

export async function refreshToday() {
  const { user } = await requireUser();
  after(async () => {
    await upsertDailyMetaNote(user.id, new Date());
  });
  revalidatePath("/today");
  return { ok: true };
}

export async function updateMetaNote(id: string, content: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("meta_notes")
    .update({
      current_content: content,
      user_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/research");
  revalidatePath("/today");
  return { ok: true };
}

export async function resolveInboxItem(
  id: string,
  action: "dismiss" | "accept_theme" | "link_entity" | "not_ticker",
  payload?: Record<string, string>,
) {
  const { supabase, user } = await requireUser();
  if (action === "accept_theme") {
    const name = payload?.name;
    if (name) {
      await supabase.from("themes").insert({
        user_id: user.id,
        name,
        normalized_name: name.toLowerCase(),
        status: "active",
      });
    }
  }
  await supabase
    .from("inbox_items")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
}

import { createAdminClient } from "@/lib/supabase/admin";
import { extractUrls } from "@/lib/urls";
import { fetchUrlMetadata } from "@/lib/url-metadata";
import { logger } from "@/lib/logger";
import type { NoteLink } from "@/types/domain";

export async function prepareNoteLinks(noteId: string): Promise<NoteLink[]> {
  const supabase = createAdminClient();
  const { data: note } = await supabase
    .from("notes")
    .select("id, user_id, raw_text")
    .eq("id", noteId)
    .single();
  if (!note) return [];

  const urls = extractUrls(note.raw_text ?? "");
  const wanted = new Set(urls.map((url) => url.toLowerCase()));
  const { data: existing } = await supabase.from("note_links").select("*").eq("note_id", noteId);
  const rows = (existing ?? []) as NoteLink[];

  for (const row of rows) {
    if (!wanted.has(row.url.toLowerCase())) {
      await supabase.from("note_links").delete().eq("id", row.id);
    }
  }

  const remaining = new Set(rows.filter((row) => wanted.has(row.url.toLowerCase())).map((row) => row.url.toLowerCase()));
  for (const url of urls) {
    if (remaining.has(url.toLowerCase())) continue;
    await supabase.from("note_links").insert({
      user_id: note.user_id,
      note_id: noteId,
      url,
      fetch_status: "pending",
    });
  }

  const { data: current } = await supabase.from("note_links").select("*").eq("note_id", noteId);
  const pending = ((current ?? []) as NoteLink[]).filter((row) => row.fetch_status === "pending");
  await Promise.all(
    pending.map(async (row) => {
      try {
        const meta = await fetchUrlMetadata(row.url);
        await supabase
          .from("note_links")
          .update({
            canonical_url: meta.finalUrl,
            title: meta.title,
            description: meta.description,
            image_url: meta.imageUrl,
            fetch_status: "ready",
            fetch_error: null,
          })
          .eq("id", row.id);
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 200) : "fetch failed";
        logger.warn("note_link_fetch_failed", { objectId: noteId });
        await supabase
          .from("note_links")
          .update({
            fetch_status: "failed",
            fetch_error: message,
          })
          .eq("id", row.id);
      }
    }),
  );

  const { data: hydrated } = await supabase
    .from("note_links")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  return (hydrated ?? []) as NoteLink[];
}

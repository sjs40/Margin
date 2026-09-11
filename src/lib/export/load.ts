import { createClient } from "@/lib/supabase/server";
import type {
  ExportAnnotation,
  ExportClaim,
  ExportEntity,
  ExportFollowup,
  ExportLink,
  ExportNote,
  ExportPriceStamp,
  ExportQuestion,
  ExportTheme,
  NoteExportExtras,
} from "@/lib/export/markdown";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function loadNotesPage(supabase: Client, userId: string, from: number, size: number) {
  const { data } = await supabase
    .from("notes")
    .select("id, captured_at, source_type, title, raw_text, interpreted_text")
    .eq("user_id", userId)
    .order("captured_at", { ascending: false })
    .range(from, from + size - 1);
  return (data ?? []) as ExportNote[];
}

export async function loadNoteExtras(supabase: Client, noteIds: string[]): Promise<Map<string, NoteExportExtras>> {
  const extras = new Map<string, NoteExportExtras>();
  if (noteIds.length === 0) return extras;
  for (const id of noteIds) extras.set(id, {});

  const [{ data: entityRows }, { data: themeRows }, { data: claims }, { data: questions }, { data: followups }, { data: annotations }, { data: links }] =
    await Promise.all([
      supabase
        .from("note_entities")
        .select("note_id, price_at_capture, price_currency, entities(ticker, canonical_name)")
        .in("note_id", noteIds),
      supabase.from("note_themes").select("note_id, themes(name)").in("note_id", noteIds),
      supabase.from("claims").select("note_id, claim_text, claim_type, status, confidence, created_at").in("note_id", noteIds),
      supabase.from("questions").select("note_id, question_text, status, resolution_comment").in("note_id", noteIds),
      supabase.from("followups").select("note_id, text, status, resolution_comment").in("note_id", noteIds),
      supabase
        .from("note_annotations")
        .select("id, note_id, text, parent_annotation_id, created_at")
        .in("note_id", noteIds)
        .order("created_at", { ascending: true }),
      supabase.from("note_links").select("note_id, url, title").in("note_id", noteIds),
    ]);

  for (const row of entityRows ?? []) {
    const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
    if (!entity) continue;
    const current = extras.get(row.note_id) ?? {};
    const entities: ExportEntity[] = [...(current.entities ?? []), { ticker: entity.ticker, name: entity.canonical_name }];
    const prices: ExportPriceStamp[] = [...(current.prices ?? [])];
    if (row.price_at_capture != null) {
      prices.push({
        ticker: entity.ticker,
        price: Number(row.price_at_capture),
        currency: row.price_currency,
      });
    }
    extras.set(row.note_id, { ...current, entities, prices });
  }
  for (const row of themeRows ?? []) {
    const theme = Array.isArray(row.themes) ? row.themes[0] : row.themes;
    if (!theme) continue;
    const current = extras.get(row.note_id) ?? {};
    const themes: ExportTheme[] = [...(current.themes ?? []), { name: theme.name }];
    extras.set(row.note_id, { ...current, themes });
  }
  for (const claim of (claims ?? []) as Array<ExportClaim & { note_id: string }>) {
    const current = extras.get(claim.note_id) ?? {};
    extras.set(claim.note_id, { ...current, claims: [...(current.claims ?? []), claim] });
  }
  for (const question of (questions ?? []) as Array<ExportQuestion & { note_id: string }>) {
    const current = extras.get(question.note_id) ?? {};
    extras.set(question.note_id, { ...current, questions: [...(current.questions ?? []), question] });
  }
  for (const followup of (followups ?? []) as Array<ExportFollowup & { note_id: string }>) {
    const current = extras.get(followup.note_id) ?? {};
    extras.set(followup.note_id, { ...current, followups: [...(current.followups ?? []), followup] });
  }
  for (const annotation of (annotations ?? []) as Array<ExportAnnotation & { note_id: string }>) {
    const current = extras.get(annotation.note_id) ?? {};
    extras.set(annotation.note_id, { ...current, annotations: [...(current.annotations ?? []), annotation] });
  }
  for (const link of (links ?? []) as Array<ExportLink & { note_id: string }>) {
    const current = extras.get(link.note_id) ?? {};
    extras.set(link.note_id, { ...current, links: [...(current.links ?? []), link] });
  }
  return extras;
}

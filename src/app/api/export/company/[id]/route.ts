import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadNoteExtras } from "@/lib/export/load";
import { companyToMarkdown, slugify } from "@/lib/export/markdown";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const { data: entity } = await supabase.from("entities").select("id, ticker, canonical_name").eq("id", id).single();
    if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: meta } = await supabase
      .from("meta_notes")
      .select("current_content")
      .eq("user_id", user.id)
      .eq("entity_id", id)
      .eq("meta_type", "company")
      .maybeSingle();
    const { data: claims } = await supabase
      .from("claims")
      .select("claim_text, claim_type, status, created_at")
      .eq("entity_id", id)
      .eq("user_id", user.id);
    const { data: questions } = await supabase
      .from("questions")
      .select("question_text, status, resolution_comment")
      .eq("entity_id", id)
      .eq("user_id", user.id);
    const { data: links } = await supabase
      .from("note_entities")
      .select("note_id, notes(id, captured_at, source_type, title, raw_text, interpreted_text)")
      .eq("entity_id", id);
    const notes = (links ?? [])
      .map((link) => {
        const note = Array.isArray(link.notes) ? link.notes[0] : link.notes;
        return note;
      })
      .filter((note): note is NonNullable<typeof note> => Boolean(note));
    const extras = await loadNoteExtras(
      supabase,
      notes.map((note) => note.id),
    );
    const markdown = companyToMarkdown(
      { ticker: entity.ticker, canonical_name: entity.canonical_name },
      {
        metaNote: meta?.current_content,
        claims: claims ?? [],
        questions: questions ?? [],
        notes: notes.map((note) => ({ note, extras: extras.get(note.id) })),
      },
    );
    const filename = `${slugify(entity.ticker || entity.canonical_name)}.md`;
    logger.info("export_company", { userId: user.id });
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

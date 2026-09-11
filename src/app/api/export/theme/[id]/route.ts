import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadNoteExtras } from "@/lib/export/load";
import { themeToMarkdown } from "@/lib/export/markdown";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const { data: theme } = await supabase
      .from("themes")
      .select("id, name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!theme) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: meta } = await supabase
      .from("meta_notes")
      .select("current_content")
      .eq("user_id", user.id)
      .eq("theme_id", id)
      .eq("meta_type", "theme")
      .maybeSingle();
    const { data: links } = await supabase
      .from("note_themes")
      .select("notes(id, captured_at, source_type, title, raw_text, interpreted_text)")
      .eq("theme_id", id);
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
    const markdown = themeToMarkdown(
      { name: theme.name },
      {
        metaNote: meta?.current_content,
        notes: notes.map((note) => ({ note, extras: extras.get(note.id) })),
      },
    );
    logger.info("export_theme", { userId: user.id });
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

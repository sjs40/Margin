import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadNoteExtras } from "@/lib/export/load";
import { noteFilename, noteToMarkdown } from "@/lib/export/markdown";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const { data: note } = await supabase
      .from("notes")
      .select("id, captured_at, source_type, title, raw_text, interpreted_text")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const extras = await loadNoteExtras(supabase, [note.id]);
    const markdown = noteToMarkdown(note, extras.get(note.id));
    const filename = noteFilename(note);
    logger.info("export_note", { userId: user.id });
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

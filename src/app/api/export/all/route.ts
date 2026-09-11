import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadNoteExtras, loadNotesPage } from "@/lib/export/load";
import type { ExportNote, NoteExportExtras } from "@/lib/export/markdown";
import { allNotesToMarkdown } from "@/lib/export/zip";
import { logger } from "@/lib/logger";

const PAGE = 500;

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const bundled: Array<{ note: ExportNote; extras?: NoteExportExtras }> = [];
    let from = 0;
    for (;;) {
      const page = await loadNotesPage(supabase, user.id, from, PAGE);
      if (page.length === 0) break;
      const extras = await loadNoteExtras(
        supabase,
        page.map((note) => note.id),
      );
      for (const note of page) bundled.push({ note, extras: extras.get(note.id) });
      if (page.length < PAGE) break;
      from += PAGE;
    }
    const zip = await allNotesToMarkdown(bundled);
    logger.info("export_all", { userId: user.id, count: bundled.length });
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="margin-notes.zip"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

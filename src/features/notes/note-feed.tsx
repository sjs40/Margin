import Link from "next/link";
import { formatCapturedAt } from "@/lib/dates";
import { hostnameOf } from "@/lib/urls";
import { ProcessingBadge } from "@/components/processing-badge";
import type { Note } from "@/types/domain";

export type FeedNote = Note & {
  note_links?: Array<{ url: string; title: string | null }>;
};

export function NoteFeed({ notes }: { notes: FeedNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        Nothing captured yet. Type above and save — organization happens afterward.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-border">
      {notes.map((note) => {
        const firstLink = note.note_links?.[0];
        return (
          <li key={note.id}>
            <Link
              href={`/notes/${note.id}`}
              className="grid min-h-11 grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-4 hover:bg-secondary/40"
            >
              <div className="pt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {formatCapturedAt(note.captured_at)}
              </div>
              <div>
                <p className="font-serif text-[17px] leading-7">
                  {note.title ||
                    note.interpreted_text ||
                    note.raw_text ||
                    (note.source_type === "handwritten_image" ? "Handwritten page" : "Untitled")}
                </p>
                {firstLink ? (
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {hostnameOf(firstLink.url)}
                    {note.note_links && note.note_links.length > 1
                      ? ` +${note.note_links.length - 1}`
                      : ""}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-3">
                  <ProcessingBadge status={note.processing_status} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {note.source_type.replace("_", " ")}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

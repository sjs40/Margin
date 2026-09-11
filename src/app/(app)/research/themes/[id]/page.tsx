import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetaNoteEditor } from "@/features/meta-notes/meta-note-editor";
import { MetaNoteHistory } from "@/features/meta-notes/meta-note-history";
import { LooseEndRow } from "@/features/research/loose-end-row";
import { mapFollowup, mapQuestion } from "@/features/research/loose-ends";
import { ExportLink } from "@/features/export/export-link";

export default async function ThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: theme } = await supabase.from("themes").select("*").eq("id", id).single();
  if (!theme) notFound();
  const { data: meta } = await supabase
    .from("meta_notes")
    .select("*")
    .eq("theme_id", id)
    .eq("meta_type", "theme")
    .maybeSingle();
  const { data: versions } = meta
    ? await supabase
        .from("meta_note_versions")
        .select("*")
        .eq("meta_note_id", meta.id)
        .order("version_number", { ascending: false })
    : { data: [] };
  const { data: noteLinks } = await supabase
    .from("note_themes")
    .select("note_id, notes(id, title, interpreted_text, raw_text, captured_at)")
    .eq("theme_id", id);

  const timeline = (noteLinks ?? [])
    .map((link) => {
      const note = Array.isArray(link.notes) ? link.notes[0] : link.notes;
      return note;
    })
    .filter((note): note is NonNullable<typeof note> => Boolean(note))
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());

  const { data: openQuestions } = await supabase
    .from("questions")
    .select("*")
    .eq("theme_id", id)
    .eq("status", "open");
  const { data: openFollowups } = await supabase
    .from("followups")
    .select("*")
    .eq("theme_id", id)
    .eq("status", "open");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-4xl">{theme.name}</h1>
      <div className="mt-3">
        <ExportLink href={`/api/export/theme/${theme.id}`} label="Export" />
      </div>
      <div className="mt-8">
        {meta?.current_content ? (
          <MetaNoteEditor id={meta.id} content={meta.current_content} />
        ) : (
          <p className="text-sm text-muted-foreground">No theme memory yet.</p>
        )}
      </div>
      {versions && versions.length > 0 && meta ? (
        <MetaNoteHistory
          currentContent={meta.current_content}
          versions={versions.map((version) => ({
            id: version.id,
            version_number: version.version_number,
            content: version.content,
            change_summary: version.change_summary,
          }))}
        />
      ) : null}
      <h2 className="mt-10 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Open questions
      </h2>
      <ul className="mt-4 space-y-4">
        {(openQuestions ?? []).map((item) => (
          <LooseEndRow key={item.id} item={mapQuestion(item)} />
        ))}
        {(openFollowups ?? []).map((item) => (
          <LooseEndRow key={item.id} item={mapFollowup(item)} />
        ))}
      </ul>
      <h2 className="mt-10 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Recent research
      </h2>
      <ul className="mt-4 divide-y divide-border">
        {(timeline).map((note) => (
            <li key={note.id} className="py-3">
              <Link href={`/notes/${note.id}`}>
                {note.title || note.interpreted_text || note.raw_text}
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}

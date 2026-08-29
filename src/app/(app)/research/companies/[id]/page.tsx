import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";
import { formatLongDate } from "@/lib/dates";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: entity } = await supabase.from("entities").select("*").eq("id", id).single();
  if (!entity) notFound();
  const { data: meta } = await supabase
    .from("meta_notes")
    .select("*")
    .eq("entity_id", id)
    .eq("meta_type", "company")
    .maybeSingle();
  const { data: versions } = meta
    ? await supabase
        .from("meta_note_versions")
        .select("*")
        .eq("meta_note_id", meta.id)
        .order("version_number", { ascending: false })
    : { data: [] };
  const { data: links } = await supabase
    .from("note_entities")
    .select("note_id, notes(id, title, raw_text, interpreted_text, captured_at)")
    .eq("entity_id", id);

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <article>
        <p className="font-mono text-sm tracking-[0.18em]">{entity.ticker}</p>
        <h1 className="mt-2 font-serif text-4xl">{entity.canonical_name}</h1>
        <div className="mt-8">
          {meta?.current_content ? (
            <Markdown content={meta.current_content} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Early research / no company memory yet.
            </p>
          )}
        </div>
      </article>
      <aside>
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Timeline
        </h2>
        <ul className="mt-4 space-y-4">
          {(links ?? []).map((link) => {
            const note = Array.isArray(link.notes) ? link.notes[0] : link.notes;
            if (!note) return null;
            return (
              <li key={note.id}>
                <Link href={`/notes/${note.id}`} className="block">
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatLongDate(note.captured_at)}
                  </p>
                  <p className="mt-1 text-sm">
                    {note.title || note.interpreted_text || note.raw_text}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
        {versions && versions.length > 0 ? (
          <div className="mt-10">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              History
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {versions.map((version) => (
                <li key={version.id}>
                  <p className="font-mono text-[11px]">v{version.version_number}</p>
                  <p className="text-muted-foreground">{version.change_summary}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

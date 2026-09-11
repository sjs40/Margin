import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";

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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-4xl">{theme.name}</h1>
      <div className="mt-8">
        {meta?.current_content ? (
          <Markdown content={meta.current_content} />
        ) : (
          <p className="text-sm text-muted-foreground">No theme memory yet.</p>
        )}
      </div>
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

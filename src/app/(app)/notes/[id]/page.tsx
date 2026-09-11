import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";
import { ProcessingBadge } from "@/components/processing-badge";
import { formatLongDate } from "@/lib/dates";
import { RetryNoteButton } from "@/features/notes/retry-button";
import { SourceCards } from "@/features/links/source-card";
import { LinkifiedText } from "@/components/linkified-text";
import { AddLooseEnd, LooseEndRow } from "@/features/research/loose-end-row";
import { mapFollowup, mapQuestion } from "@/features/research/loose-ends";
import { NoteAnnotations } from "@/features/notes/note-annotations";
import { formatCapturePrice } from "@/lib/prices/format";
import type { NoteLink, ProcessingStatus } from "@/types/domain";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: note } = await supabase.from("notes").select("*").eq("id", id).single();
  if (!note) notFound();
  const [{ data: companies }, { data: themes }, { data: questions }, { data: followups }, { data: claims }, { data: links }, { data: annotations }] =
    await Promise.all([
      supabase
        .from("note_entities")
        .select("confidence, price_at_capture, entities(id, ticker, canonical_name)")
        .eq("note_id", id),
      supabase.from("note_themes").select("confidence, themes(id, name)").eq("note_id", id),
      supabase.from("questions").select("*").eq("note_id", id),
      supabase.from("followups").select("*").eq("note_id", id),
      supabase.from("claims").select("*").eq("note_id", id),
      supabase.from("note_links").select("*").eq("note_id", id).order("created_at", { ascending: true }),
      supabase
        .from("note_annotations")
        .select("id, text, created_at, parent_annotation_id")
        .eq("note_id", id)
        .order("created_at", { ascending: true }),
    ]);

  let imageUrl: string | null = null;
  if (note.source_asset_id) {
    const { data: asset } = await supabase
      .from("source_assets")
      .select("storage_path")
      .eq("id", note.source_asset_id)
      .single();
    if (asset) {
      const signed = await supabase.storage
        .from("source-assets")
        .createSignedUrl(asset.storage_path, 3600);
      imageUrl = signed.data?.signedUrl ?? null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {formatLongDate(note.captured_at)} · {note.source_type.replace("_", " ")}
      </p>
      <h1 className="mt-2 font-serif text-3xl leading-tight md:text-3xl">{note.title || "Note"}</h1>
      <div className="mt-3 flex items-center gap-3">
        <ProcessingBadge status={note.processing_status as ProcessingStatus} />
        {note.processing_status === "failed" ? <RetryNoteButton noteId={note.id} /> : null}
      </div>
      <SourceCards links={(links ?? []) as NoteLink[]} />
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Original handwritten page" className="mt-6 rounded-lg border" />
      ) : null}
      {note.literal_transcription ? (
        <section className="mt-8">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Literal transcription
          </h2>
          <p className="mt-2 font-mono text-sm leading-6">{note.literal_transcription}</p>
        </section>
      ) : null}
      <section className="mt-8">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Interpreted
        </h2>
        <div className="mt-2">
          <Markdown content={note.interpreted_text || note.raw_text || ""} />
        </div>
      </section>
      <section className="mt-8">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Raw source
        </h2>
        {note.raw_text ? <LinkifiedText text={note.raw_text} /> : <p className="mt-2 text-sm text-muted-foreground">No raw text.</p>}
      </section>
      <NoteAnnotations noteId={note.id} annotations={annotations ?? []} />
      <MetaList
        title="Companies"
        items={(companies ?? []).map((row) => {
          const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
          if (!entity) return null;
          const ticker = entity.ticker || entity.canonical_name;
          const stamp =
            entity.ticker && row.price_at_capture != null
              ? formatCapturePrice(entity.ticker, Number(row.price_at_capture))
              : ticker;
          return { href: `/research/companies/${entity.id}`, label: stamp };
        })}
      />
      <MetaList
        title="Themes"
        items={(themes ?? []).map((row) => {
          const theme = Array.isArray(row.themes) ? row.themes[0] : row.themes;
          return theme ? { href: `/research/themes/${theme.id}`, label: theme.name } : null;
        })}
      />
      <section className="mt-8">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Questions
        </h2>
        <ul className="mt-2 space-y-4">
          {(questions ?? []).map((item) => (
            <LooseEndRow key={item.id} contextNoteId={note.id} item={mapQuestion(item)} />
          ))}
        </ul>
        <h2 className="mt-8 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Follow-ups
        </h2>
        <ul className="mt-2 space-y-4">
          {(followups ?? []).map((item) => (
            <LooseEndRow key={item.id} contextNoteId={note.id} item={mapFollowup(item)} />
          ))}
        </ul>
        <AddLooseEnd noteId={note.id} />
      </section>
      <SimpleList title="Claims" items={(claims ?? []).map((item) => `${item.claim_type}: ${item.claim_text}`)} />
    </div>
  );
}

function MetaList({
  title,
  items,
}: {
  title: string;
  items: Array<{ href: string; label: string } | null>;
}) {
  const present = items.filter((item): item is { href: string; label: string } => Boolean(item));
  if (present.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {present.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border border-border px-2 py-1 font-mono text-xs"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function SimpleList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetaNoteEditor } from "@/features/meta-notes/meta-note-editor";
import { MetaNoteHistory } from "@/features/meta-notes/meta-note-history";
import { formatLongDate } from "@/lib/dates";
import { ClaimsSection, type CompanyClaim } from "@/features/research/claims-section";
import { LooseEndRow } from "@/features/research/loose-end-row";
import { mapFollowup, mapQuestion } from "@/features/research/loose-ends";
import { fetchQuote } from "@/lib/prices/provider";
import { formatQuotePrice, formatTickerPrice, percentChange } from "@/lib/prices/format";

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
    .select("note_id, price_at_capture, notes(id, title, raw_text, interpreted_text, captured_at)")
    .eq("entity_id", id);
  const { data: claimRows } = await supabase
    .from("claims")
    .select("id, claim_text, claim_type, confidence, status, created_at, note_id, notes(id, captured_at)")
    .eq("entity_id", id)
    .order("created_at", { ascending: true });
  const claimIds = (claimRows ?? []).map((row) => row.id);
  const { data: relationRows } =
    claimIds.length > 0
      ? await supabase
          .from("claim_relations")
          .select("claim_id, related_claim_id, relation_type")
          .in("related_claim_id", claimIds)
          .in("relation_type", ["contradicts", "supersedes"])
      : { data: [] };
  const newerIds = [...new Set((relationRows ?? []).map((row) => row.claim_id))];
  const { data: newerClaims } =
    newerIds.length > 0
      ? await supabase.from("claims").select("id, note_id").in("id", newerIds)
      : { data: [] };
  const newerNoteByClaim = new Map((newerClaims ?? []).map((row) => [row.id, row.note_id]));

  const newerByPrior = new Map<string, { claimId: string; noteId: string | null }>();
  for (const relation of relationRows ?? []) {
    newerByPrior.set(relation.related_claim_id, {
      claimId: relation.claim_id,
      noteId: newerNoteByClaim.get(relation.claim_id) ?? null,
    });
  }

  const claims: CompanyClaim[] = (claimRows ?? []).map((row) => {
    const note = Array.isArray(row.notes) ? row.notes[0] : row.notes;
    const newer = newerByPrior.get(row.id);
    return {
      id: row.id,
      claim_text: row.claim_text,
      claim_type: row.claim_type,
      confidence: row.confidence,
      status: row.status ?? "active",
      created_at: row.created_at,
      captured_at: note?.captured_at ?? null,
      note_id: row.note_id,
      newerClaimId: newer?.claimId ?? null,
      newerNoteId: newer?.noteId ?? null,
    };
  });

  const { data: openQuestions } = await supabase
    .from("questions")
    .select("*")
    .eq("entity_id", id)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  const { data: openFollowups } = await supabase
    .from("followups")
    .select("*")
    .eq("entity_id", id)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  const timeline = (links ?? [])
    .map((link) => {
      const note = Array.isArray(link.notes) ? link.notes[0] : link.notes;
      if (!note) return null;
      return { ...note, price_at_capture: link.price_at_capture as number | null };
    })
    .filter((note): note is NonNullable<typeof note> => Boolean(note))
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());

  const currentQuote = entity.ticker
    ? await fetchQuote(entity.ticker, { timeoutMs: 3000, revalidateSeconds: 60 })
    : null;
  const earliestStamp = [...timeline]
    .filter((note) => note.price_at_capture != null)
    .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())[0];
  const move =
    currentQuote && earliestStamp?.price_at_capture != null
      ? percentChange(currentQuote.price, Number(earliestStamp.price_at_capture))
      : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <article>
        <p className="font-mono text-sm tracking-[0.18em]">{entity.ticker}</p>
        <h1 className="mt-2 font-serif text-4xl">{entity.canonical_name}</h1>
        {currentQuote ? (
          <p className="mt-3 font-mono text-sm text-muted-foreground">
            {formatQuotePrice(currentQuote.price, currentQuote.currency)}
            {move != null ? ` · ${move >= 0 ? "+" : ""}${move.toFixed(1)}% since first stamped note` : ""}
            <span className="ml-2 text-[11px] uppercase tracking-[0.12em]">informational</span>
          </p>
        ) : null}
        <div className="mt-8">
          {meta?.current_content ? (
            <MetaNoteEditor id={meta.id} content={meta.current_content} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Early research / no company memory yet.
            </p>
          )}
        </div>
        <ClaimsSection claims={claims} />
        <section className="mt-10">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
          {(openQuestions ?? []).length === 0 && (openFollowups ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No open items.</p>
          ) : null}
        </section>
      </article>
      <aside>
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Timeline
        </h2>
        <ul className="mt-4 space-y-4">
          {timeline.map((note) => (
            <li key={note.id}>
              <Link href={`/notes/${note.id}`} className="block">
                <p className="font-mono text-[11px] text-muted-foreground">
                  {formatLongDate(note.captured_at)}
                  {note.price_at_capture != null && entity.ticker
                    ? ` · ${formatTickerPrice(entity.ticker, Number(note.price_at_capture))}`
                    : ""}
                </p>
                <p className="mt-1 text-sm">
                  {note.title || note.interpreted_text || note.raw_text}
                </p>
              </Link>
            </li>
          ))}
        </ul>
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
      </aside>
    </div>
  );
}
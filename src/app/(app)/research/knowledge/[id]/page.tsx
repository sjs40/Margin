import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeEditor } from "@/features/knowledge/knowledge-editor";
import { KnowledgeSourceControls, SourceRoleSelect } from "@/features/knowledge/source-controls";
import { CopyContextButton } from "@/features/context/copy-context-button";
import { DevelopAction } from "@/features/context/develop-action";
import { evidenceStats, sourceHref } from "@/lib/knowledge";
import { formatLongDate } from "@/lib/dates";
import { AcceptRelationButton } from "@/features/knowledge/accept-relation-button";
import type { KnowledgeSourceRole, KnowledgeSourceType } from "@/types/domain";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: object } = await supabase.from("knowledge_objects").select("*").eq("id", id).single();
  if (!object) notFound();
  const [
    { data: sources },
    { data: entities },
    { data: themes },
    { data: versions },
    { data: outbound },
    { data: inbound },
  ] = await Promise.all([
    supabase.from("knowledge_object_sources").select("*").eq("knowledge_object_id", id).order("created_at", { ascending: false }),
    supabase.from("knowledge_object_entities").select("entities(id, ticker, canonical_name)").eq("knowledge_object_id", id),
    supabase.from("knowledge_object_themes").select("themes(id, name)").eq("knowledge_object_id", id),
    supabase
      .from("knowledge_object_versions")
      .select("*")
      .eq("knowledge_object_id", id)
      .order("version_number", { ascending: false }),
    supabase.from("knowledge_relationships").select("*").eq("from_object_id", id),
    supabase.from("knowledge_relationships").select("*").eq("to_object_id", id),
  ]);
  const relatedIds = [
    ...new Set([
      ...(outbound ?? []).map((row) => row.to_object_id),
      ...(inbound ?? []).map((row) => row.from_object_id),
    ]),
  ];
  const { data: relatedObjects } =
    relatedIds.length > 0
      ? await supabase.from("knowledge_objects").select("id, title, kind").in("id", relatedIds)
      : { data: [] };
  const relatedById = new Map((relatedObjects ?? []).map((row) => [row.id, row]));
  const entityIds = (entities ?? []).flatMap((row) => {
    const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
    return entity ? [entity.id] : [];
  });
  const themeIds = (themes ?? []).flatMap((row) => {
    const theme = Array.isArray(row.themes) ? row.themes[0] : row.themes;
    return theme ? [theme.id] : [];
  });
  let questionsQuery = supabase.from("questions").select("id, question_text, note_id, document_id").eq("status", "open").limit(12);
  if (entityIds[0]) questionsQuery = questionsQuery.eq("entity_id", entityIds[0]);
  else if (themeIds[0]) questionsQuery = questionsQuery.eq("theme_id", themeIds[0]);
  const { data: questions } = entityIds.length || themeIds.length ? await questionsQuery : { data: [] };
  const stats = evidenceStats(
    (sources ?? []).map((source) => ({
      role: source.role,
      sourceType: source.source_type,
      sourceId: source.source_id,
      createdAt: source.created_at,
    })),
    entityIds,
  );
  const supporting = (sources ?? []).filter((source) => source.role === "support" || source.role === "origin" || source.role === "example");
  const counter = (sources ?? []).filter((source) =>
    source.role === "counterevidence" || source.role === "counterexample" || source.role === "boundary_condition",
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Link href="/research/knowledge">Knowledge</Link>
        {" / "}
        {object.kind}
        {object.origin === "ai" && !object.user_edited ? " · AI suggested" : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-serif text-3xl">{object.title}</h1>
        <div className="flex flex-wrap gap-2">
          <CopyContextButton seedType={object.kind} seedId={object.id} />
          <DevelopAction />
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {object.maturity ? object.maturity.replaceAll("_", " ") : "No maturity yet"}
        {" · "}
        {stats.supportingSources} independent supporting sources
        {" · "}
        {stats.distinctCompanies} companies
        {" · "}
        {stats.counterItems} counterexamples/counterevidence
        {stats.lastStrengthenedAt ? ` · last strengthened ${formatLongDate(stats.lastStrengthenedAt)}` : ""}
        {stats.lastChallengedAt ? ` · last challenged ${formatLongDate(stats.lastChallengedAt)}` : ""}
      </p>
      <div className="mt-6">
        <KnowledgeEditor
          id={object.id}
          title={object.title}
          summary={object.summary}
          body={object.body}
          state={object.state}
        />
      </div>
      <Section title={object.kind === "framework" ? "Mechanism" : "Why it matters"}>
        <p className="text-sm leading-6">{object.body || object.summary}</p>
      </Section>
      <Section title="Companies / themes">
        <ul className="space-y-1 text-sm">
          {(entities ?? []).map((row) => {
            const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
            if (!entity) return null;
            return (
              <li key={entity.id}>
                <Link href={`/research/companies/${entity.id}`}>{entity.ticker || entity.canonical_name}</Link>
              </li>
            );
          })}
          {(themes ?? []).map((row) => {
            const theme = Array.isArray(row.themes) ? row.themes[0] : row.themes;
            if (!theme) return null;
            return (
              <li key={theme.id}>
                <Link href={`/research/themes/${theme.id}`}>{theme.name}</Link>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Sources / provenance">
        {(sources ?? []).map((source) => (
          <div key={source.id} className="py-3">
            <Link href={sourceHref(source.source_type as KnowledgeSourceType, source.source_id)} className="text-sm underline">
              {source.source_type} · {source.role.replaceAll("_", " ")}
            </Link>
            {source.excerpt ? <p className="mt-1 text-sm text-muted-foreground">{source.excerpt}</p> : null}
            {source.created_by === "ai" ? (
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">AI suggested</p>
            ) : null}
            <SourceRoleSelect id={source.id} role={source.role as KnowledgeSourceRole} />
          </div>
        ))}
        <KnowledgeSourceControls objectId={object.id} />
      </Section>
      <Section title="Supporting evidence">{supporting.length} items after origin-note dedupe: {stats.supportingSources} independent.</Section>
      <Section title="Counterevidence / examples / boundary conditions">{counter.length} recorded.</Section>
      <Section title="Related">
        <ul className="space-y-2 text-sm">
          {[...(outbound ?? []), ...(inbound ?? [])].map((row) => {
            const otherId = row.from_object_id === id ? row.to_object_id : row.from_object_id;
            const other = relatedById.get(otherId);
            return (
              <li key={row.id}>
                <Link href={`/research/knowledge/${otherId}`}>{other?.title || otherId}</Link>
                <span className="text-muted-foreground"> · {row.relation_type.replaceAll("_", " ")} · {row.state}</span>
                <p className="text-muted-foreground">{row.explanation}</p>
                {row.state === "proposed" ? <AcceptRelationButton id={row.id} /> : null}
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Open questions">
        <ul className="space-y-2 text-sm">
          {(questions ?? []).map((item) => (
            <li key={item.id}>
              {item.note_id ? <Link href={`/notes/${item.note_id}`}>{item.question_text}</Link> : item.question_text}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Version history">
        <ul className="space-y-2 text-sm">
          {(versions ?? []).map((version) => (
            <li key={version.id}>
              <span className="font-mono text-[11px]">v{version.version_number}</span>
              <span className="text-muted-foreground"> · {version.origin} · {formatLongDate(version.created_at)}</span>
              <p>{version.change_summary}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

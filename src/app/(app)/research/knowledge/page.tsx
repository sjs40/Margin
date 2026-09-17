import Link from "next/link";
import { listKnowledgeObjects } from "@/features/knowledge/queries";
import { CreateKnowledgeForm } from "@/features/knowledge/create-form";
import { formatLongDate } from "@/lib/dates";

const TABS = [
  { id: "insights", label: "Active Insights" },
  { id: "frameworks", label: "Active Frameworks" },
  { id: "proposed", label: "Proposed" },
  { id: "archived", label: "Archived" },
] as const;

export default async function KnowledgeIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab = "insights", q } = await searchParams;
  const current = TABS.some((item) => item.id === tab) ? tab : "insights";
  const rows = await listKnowledgeObjects({
    tab: current as "insights" | "frameworks" | "proposed" | "archived",
    q,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Link href="/research">Research</Link>
        {" / "}
        Knowledge
      </p>
      <h1 className="mt-2 font-serif text-3xl">Knowledge</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Durable insights and frameworks. Proposed items wait here until you accept them.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/research/knowledge?tab=${item.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm ${current === item.id ? "border-foreground" : "border-border text-muted-foreground"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <form className="mt-4" method="get">
        <input type="hidden" name="tab" value={current} />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title or formulation"
          className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </form>
      <ul className="mt-8 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="py-4">
            <Link href={`/research/knowledge/${row.id}`} className="block">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {row.kind}
                {row.maturity ? ` · ${row.maturity.replaceAll("_", " ")}` : ""}
                {row.origin === "ai" && !row.user_edited ? " · AI suggested" : ""}
              </p>
              <p className="mt-1 font-medium">{row.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{row.summary}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {row.companies.map((company) => company.label).join(", ") || "No companies"}
                {" · "}
                {row.themes.map((theme) => theme.name).join(", ") || "No themes"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {row.stats.supportingSources} supporting · {row.stats.counterItems} counter · {row.provenanceCount} provenance · {formatLongDate(row.updated_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing in this view yet.</p>
      ) : null}
      <CreateKnowledgeForm />
    </div>
  );
}

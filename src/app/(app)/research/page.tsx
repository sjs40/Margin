import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ResearchPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: companyLinks } = await supabase
    .from("note_entities")
    .select("entity_id, created_at, entities(id, ticker, canonical_name), notes!inner(user_id)")
    .eq("notes.user_id", auth.user.id);
  const { data: themes } = await supabase
    .from("themes")
    .select("id, name, updated_at")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  const companies = new Map<
    string,
    { id: string; ticker: string | null; name: string; count: number; updated: string }
  >();
  for (const link of companyLinks ?? []) {
    const entity = Array.isArray(link.entities) ? link.entities[0] : link.entities;
    if (!entity) continue;
    const current = companies.get(entity.id) ?? {
      id: entity.id,
      ticker: entity.ticker,
      name: entity.canonical_name,
      count: 0,
      updated: link.created_at,
    };
    current.count += 1;
    if (link.created_at > current.updated) current.updated = link.created_at;
    companies.set(entity.id, current);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-serif text-3xl">Research</h1>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Companies
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {[...companies.values()]
              .sort((a, b) => b.updated.localeCompare(a.updated))
              .map((company) => (
                <li key={company.id} className="py-3">
                  <Link href={`/research/companies/${company.id}`} className="block">
                    <p className="font-mono text-sm">{company.ticker ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">
                      {company.name} · {company.count} notes
                    </p>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
        <section>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Themes
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {(themes ?? []).map((theme) => (
              <li key={theme.id} className="py-3">
                <Link href={`/research/themes/${theme.id}`} className="block">
                  <p>{theme.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

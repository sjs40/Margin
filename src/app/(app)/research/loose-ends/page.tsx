import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LooseEndRow, AddLooseEnd } from "@/features/research/loose-end-row";
import { mapFollowup, mapQuestion } from "@/features/research/loose-ends";
import { LOOSE_END_SELECT } from "@/lib/loose-ends";

export default async function LooseEndsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; company?: string; theme?: string }>;
}) {
  const { tab = "open", company, theme } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  let questionsQuery = supabase
    .from("questions")
    .select(LOOSE_END_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  let followupsQuery = supabase
    .from("followups")
    .select(LOOSE_END_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (tab === "resolved") {
    questionsQuery = questionsQuery.eq("status", "resolved");
    followupsQuery = followupsQuery.eq("status", "completed");
  } else if (tab === "dismissed") {
    questionsQuery = questionsQuery.eq("status", "dismissed");
    followupsQuery = followupsQuery.eq("status", "dismissed");
  } else {
    questionsQuery = questionsQuery.eq("status", "open");
    followupsQuery = followupsQuery.eq("status", "open");
  }
  if (company) {
    questionsQuery = questionsQuery.eq("entity_id", company);
    followupsQuery = followupsQuery.eq("entity_id", company);
  }
  if (theme) {
    questionsQuery = questionsQuery.eq("theme_id", theme);
    followupsQuery = followupsQuery.eq("theme_id", theme);
  }

  const [{ data: questions }, { data: followups }, { data: companies }, { data: themes }] =
    await Promise.all([
      questionsQuery,
      followupsQuery,
      supabase.from("note_entities").select("entity_id, entities(id, ticker, canonical_name)").limit(80),
      supabase.from("themes").select("id, name").eq("user_id", auth.user.id).eq("status", "active"),
    ]);

  const tabs = [
    { id: "open", label: "Open" },
    { id: "resolved", label: "Resolved" },
    { id: "dismissed", label: "Dismissed" },
  ];

  const uniqueCompanies = new Map<string, string>();
  for (const row of companies ?? []) {
    const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
    if (entity) uniqueCompanies.set(entity.id, entity.ticker || entity.canonical_name);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">Loose Ends</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/research/loose-ends?tab=${item.id}${company ? `&company=${company}` : ""}${theme ? `&theme=${theme}` : ""}`}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm ${tab === item.id ? "border-foreground" : "border-border text-muted-foreground"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <input type="hidden" name="tab" value={tab} />
        <select name="company" defaultValue={company ?? ""} className="min-h-11 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">All companies</option>
          {[...uniqueCompanies.entries()].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select name="theme" defaultValue={theme ?? ""} className="min-h-11 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">All themes</option>
          {(themes ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-md border border-border px-3 text-sm">
          Filter
        </button>
      </form>
      <ul className="mt-8 space-y-6">
        {(questions ?? []).map((row) => (
          <LooseEndRow key={row.id} allowNotePicker item={mapQuestion(row)} />
        ))}
        {(followups ?? []).map((row) => (
          <LooseEndRow key={row.id} allowNotePicker item={mapFollowup(row)} />
        ))}
      </ul>
      {(questions ?? []).length === 0 && (followups ?? []).length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing in this tab.</p>
      ) : null}
      <div className="mt-10">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Add
        </h2>
        <AddLooseEnd />
      </div>
    </div>
  );
}
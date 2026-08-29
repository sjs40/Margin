"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

type Hit = {
  id: string;
  kind: string;
  title: string;
  snippet: string;
  date?: string;
  sourceType?: string;
  tickers?: string[];
};

type AskResult = {
  answer: { answer: string; sources: Array<{ id: string; kind: string; title: string; date: string | null }> };
  hits: Hit[];
};

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [ask, setAsk] = useState<AskResult | null>(null);
  const [pending, setPending] = useState(false);

  async function run(mode: "search" | "ask") {
    setPending(true);
    setAsk(null);
    const response = await fetch(mode === "ask" ? "/api/ask" : "/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    setPending(false);
    if (mode === "ask") setAsk(data);
    else setHits(data.hits ?? []);
  }

  const groups = ["company", "theme", "note", "document", "meta_note"] as const;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">Search</h1>
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void run("search");
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your research..."
          className="h-12 text-base"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !query.trim()}>
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !query.trim()}
            onClick={() => void run("ask")}
          >
            Ask Margin
          </Button>
        </div>
      </form>
      {ask ? (
        <section className="mt-8 rounded-lg border border-border p-5">
          <p className="font-sans text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Synthesis
          </p>
          <Markdown content={ask.answer.answer} />
          <ul className="mt-4 space-y-2 text-sm">
            {ask.answer.sources.map((source) => (
              <li key={`${source.kind}-${source.id}`}>
                <Link className="underline" href={hrefFor(source.kind, source.id)}>
                  {source.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-8 space-y-8">
        {groups.map((kind) => {
          const items = hits.filter((hit) => hit.kind === kind);
          if (items.length === 0) return null;
          return (
            <section key={kind}>
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {kind.replace("_", " ")}s
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {items.map((hit) => (
                  <li key={hit.id} className="py-3">
                    <Link href={hrefFor(hit.kind, hit.id)} className="block">
                      <p className="font-medium">{hit.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{hit.snippet}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function hrefFor(kind: string, id: string) {
  switch (kind) {
    case "note":
      return `/notes/${id}`;
    case "document":
      return `/documents/${id}`;
    case "company":
      return `/research/companies/${id}`;
    case "theme":
      return `/research/themes/${id}`;
    default:
      return "/research";
  }
}

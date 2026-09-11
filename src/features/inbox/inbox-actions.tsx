"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveInboxItem, searchCompaniesAction } from "@/features/capture/actions";
import { mergeSuggestedTheme } from "@/features/research/actions";

type Item = {
  id: string;
  category: string;
  payload: Record<string, unknown>;
};

type SearchHit = { id: string; ticker: string | null; name: string };

export function InboxActions({
  item,
  themes = [],
}: {
  item: Item;
  themes?: Array<{ id: string; name: string }>;
}) {
  const [query, setQuery] = useState(
    String(item.payload.ticker ?? item.payload.canonicalName ?? ""),
  );
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [createName, setCreateName] = useState(String(item.payload.canonicalName ?? ""));
  const [createTicker, setCreateTicker] = useState(String(item.payload.ticker ?? ""));
  const [mergeTarget, setMergeTarget] = useState(String(item.payload.similarThemeId ?? themes[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void searchCompaniesAction(q).then(setHits);
    }, 200);
  }

  async function run(
    action:
      | "dismiss"
      | "accept_theme"
      | "link_entity"
      | "not_ticker"
      | "confirm_contradiction"
      | "reject_contradiction",
    payload?: Record<string, string>,
  ) {
    setError(null);
    const result = await resolveInboxItem(item.id, action, payload);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mt-3 space-y-3">
      {item.category === "suggested_theme" ? (
        <div className="space-y-2">
          <Button
            className="min-h-11 md:h-8 md:min-h-8"
            onClick={() => void run("accept_theme", { name: String(item.payload.name ?? "") })}
          >
            Create theme
          </Button>
          {themes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-h-11 rounded-md border border-border bg-background px-2 text-sm md:h-8 md:min-h-8"
                value={mergeTarget}
                onChange={(event) => setMergeTarget(event.target.value)}
              >
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
              <Button
                className="min-h-11 md:h-8 md:min-h-8"
                variant="outline"
                onClick={async () => {
                  setError(null);
                  const result = await mergeSuggestedTheme(String(item.payload.name ?? ""), mergeTarget);
                  if (result && "error" in result && result.error) {
                    setError(result.error);
                    return;
                  }
                  await run("dismiss");
                }}
              >
                Merge into existing…
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {item.category === "ambiguous_entity" ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div>
            <Label htmlFor={`search-${item.id}`}>Link to a company</Label>
            <Input
              id={`search-${item.id}`}
              className="mt-1 min-h-11 md:h-8 md:min-h-8"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onFocus={() => {
                const q = query.trim();
                if (q.length >= 1) void searchCompaniesAction(q).then(setHits);
              }}
              placeholder="Ticker or name"
            />
            {hits.length > 0 ? (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {hits.map((hit) => (
                  <li key={hit.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                    <span>
                      <span className="font-mono">{hit.ticker ?? "—"}</span>
                      <span className="text-muted-foreground"> · {hit.name}</span>
                    </span>
                    <Button
                      className="min-h-11 md:h-8 md:min-h-8"
                      size="sm"
                      onClick={() => void run("link_entity", { entityId: hit.id })}
                    >
                      Link
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor={`name-${item.id}`}>Or create a company</Label>
              <Input
                id={`name-${item.id}`}
                className="mt-1 min-h-11 md:h-8 md:min-h-8"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Name"
              />
            </div>
            <div>
              <Label htmlFor={`ticker-${item.id}`}>Ticker (optional)</Label>
              <Input
                id={`ticker-${item.id}`}
                className="mt-1 min-h-11 md:h-8 md:min-h-8"
                value={createTicker}
                onChange={(event) => setCreateTicker(event.target.value.toUpperCase())}
                placeholder="USER"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 md:h-8 md:min-h-8"
              variant="outline"
              onClick={() =>
                void run("link_entity", { name: createName, ticker: createTicker })
              }
            >
              Create and link
            </Button>
            <Button
              className="min-h-11 md:h-8 md:min-h-8"
              variant="outline"
              onClick={() => void run("not_ticker")}
            >
              Not a ticker
            </Button>
          </div>
        </div>
      ) : null}
      {item.category === "contradiction" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11 md:h-8 md:min-h-8"
            onClick={() => void run("confirm_contradiction")}
          >
            Confirm
          </Button>
          <Button
            className="min-h-11 md:h-8 md:min-h-8"
            variant="outline"
            onClick={() => void run("reject_contradiction")}
          >
            Not a contradiction
          </Button>
        </div>
      ) : null}
      <Button
        className="min-h-11 md:h-8 md:min-h-8"
        variant="ghost"
        onClick={() => void run("dismiss")}
      >
        Dismiss
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
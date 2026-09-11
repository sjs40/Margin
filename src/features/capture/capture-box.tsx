"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Import } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createTextNote } from "@/features/capture/actions";
import { mergeCaptureDraft } from "@/lib/share";
import { activeCashtagQuery, insertCashtag } from "@/lib/tickers";

const DRAFT_KEY = "margin.capture.draft";

type EntityHit = { id: string; ticker: string | null; name: string };

export function CaptureBox({ initialValue = "" }: { initialValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(() => {
    const draft = typeof window === "undefined" ? "" : (window.localStorage.getItem(DRAFT_KEY) ?? "");
    return mergeCaptureDraft(draft, initialValue);
  });
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [openAbove, setOpenAbove] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<number | null>(null);
  const cashtagRef = useRef<ReturnType<typeof activeCashtagQuery>>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (desktop) ref.current?.focus();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, value);
  }, [value]);

  useEffect(() => {
    function persistDraft() {
      if (document.visibilityState === "hidden" && value.trim()) {
        window.localStorage.setItem(DRAFT_KEY, value);
      }
    }
    document.addEventListener("visibilitychange", persistDraft);
    return () => document.removeEventListener("visibilitychange", persistDraft);
  }, [value]);

  function scheduleSuggest(text: string, cursor: number) {
    const active = activeCashtagQuery(text, cursor);
    cashtagRef.current = active;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!active) {
      setHits([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      const box = ref.current?.getBoundingClientRect();
      if (box) setOpenAbove(window.innerHeight - box.bottom < 220);
      void fetch(`/api/entities/search?q=${encodeURIComponent(active.query)}`)
        .then((response) => response.json())
        .then((data: EntityHit[]) => {
          if (cashtagRef.current?.query !== active.query) return;
          setHits(Array.isArray(data) ? data : []);
          setSelected(0);
        })
        .catch(() => setHits([]));
    }, 200);
  }

  function applyHit(hit: EntityHit) {
    const active = cashtagRef.current;
    const ticker = hit.ticker;
    if (!active || !ticker || !ref.current) return;
    const next = insertCashtag(value, active.start, ref.current.selectionStart, ticker);
    setValue(next);
    setHits([]);
    requestAnimationFrame(() => {
      const pos = active.start + ticker.length + 2;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    const text = value.trim();
    if (!text) return;
    setError(null);
    setSyncing(true);
    const result = await createTextNote(text, text.length > 800 ? "longform" : "typed");
    setSyncing(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setValue("");
    setHits([]);
    window.localStorage.removeItem(DRAFT_KEY);
    const mobile = !window.matchMedia("(min-width: 768px)").matches;
    if (mobile) {
      toast("Saved");
      requestAnimationFrame(() => ref.current?.focus());
    }
    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-none md:p-5">
      <label htmlFor="capture" className="sr-only">
        {"What's on your mind?"}
      </label>
      <div className="relative">
        <Textarea
          id="capture"
          ref={ref}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            scheduleSuggest(event.target.value, event.target.selectionStart);
          }}
          onClick={(event) => scheduleSuggest(event.currentTarget.value, event.currentTarget.selectionStart)}
          placeholder="What's on your mind?"
          className="min-h-36 resize-y border-0 bg-transparent px-0 pb-14 text-[17px] leading-7 shadow-none focus-visible:ring-0 md:min-h-44 md:pb-0 md:text-lg"
          onKeyDown={(event) => {
            if (hits.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((index) => Math.min(index + 1, hits.length - 1));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((index) => Math.max(index - 1, 0));
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setHits([]);
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                const hit = hits[selected];
                if (hit?.ticker) {
                  event.preventDefault();
                  applyHit(hit);
                  return;
                }
              }
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void save();
            }
          }}
        />
        {hits.length > 0 ? (
          <ul
            className={`absolute z-20 max-h-56 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-md ${openAbove ? "bottom-full mb-2" : "top-full mt-2"}`}
          >
            {hits.map((hit, index) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full items-center px-3 text-left text-sm ${index === selected ? "bg-secondary" : ""}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyHit(hit);
                  }}
                >
                  <span className="font-mono text-xs">{hit.ticker}</span>
                  <span className="ml-2 text-muted-foreground">· {hit.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          type="button"
          onClick={() => void save()}
          disabled={pending || syncing || !value.trim()}
          className="absolute right-0 bottom-1 min-h-11 min-w-11 px-4 md:hidden"
        >
          Save
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button asChild variant="outline" className="min-h-11 px-3 md:h-8 md:min-h-8">
            <Link href="/camera">
              <Camera className="size-4" />
              Camera
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 px-3 md:h-8 md:min-h-8">
            <Link href="/import">
              <Import className="size-4" />
              Import
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {syncing ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Saving
            </span>
          ) : (
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:inline">
              Ctrl + Enter
            </span>
          )}
          <Button
            onClick={() => void save()}
            disabled={pending || syncing || !value.trim()}
            className="hidden min-h-11 px-4 md:inline-flex md:h-8 md:min-h-8"
          >
            Save
          </Button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

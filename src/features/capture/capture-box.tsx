"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createTextNote } from "@/features/capture/actions";

const DRAFT_KEY = "margin.capture.draft";

export function CaptureBox() {
  const router = useRouter();
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (desktop) ref.current?.focus();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, value);
  }, [value]);

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
    window.localStorage.removeItem(DRAFT_KEY);
    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-none md:p-5">
      <label htmlFor="capture" className="sr-only">
        {"What's on your mind?"}
      </label>
      <Textarea
        id="capture"
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="What's on your mind?"
        className="min-h-36 resize-y border-0 bg-transparent px-0 text-[17px] leading-7 shadow-none focus-visible:ring-0 md:min-h-44 md:text-lg"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save();
          }
        }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/camera">
              <Camera className="size-4" />
              Camera
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
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
          <Button onClick={() => void save()} disabled={pending || syncing || !value.trim()}>
            Save
          </Button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createKnowledgeObject } from "@/features/knowledge/actions";
import type { KnowledgeKind } from "@/types/domain";

export function CreateKnowledgeForm() {
  const router = useRouter();
  const [kind, setKind] = useState<KnowledgeKind>("insight");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-6 space-y-3 rounded-lg border border-border p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await createKnowledgeObject({ kind, title, summary, body });
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.id) router.push(`/research/knowledge/${result.id}`);
      }}
    >
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        New
      </h2>
      <select
        className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
        value={kind}
        onChange={(event) => setKind(event.target.value as KnowledgeKind)}
      >
        <option value="insight">Insight</option>
        <option value="framework">Framework</option>
      </select>
      <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Textarea placeholder="Concise formulation" value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} />
      <Textarea placeholder="Fuller reasoning / mechanism" value={body} onChange={(event) => setBody(event.target.value)} rows={5} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !title.trim() || !summary.trim()}>
        Create
      </Button>
    </form>
  );
}

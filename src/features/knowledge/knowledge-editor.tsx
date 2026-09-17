"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { updateKnowledgeObject, setKnowledgeState, mergeKnowledgeObject } from "@/features/knowledge/actions";

export function KnowledgeEditor({
  id,
  title,
  summary,
  body,
  state,
}: {
  id: string;
  title: string;
  summary: string;
  body: string;
  state: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nextTitle, setNextTitle] = useState(title);
  const [nextSummary, setNextSummary] = useState(summary);
  const [nextBody, setNextBody] = useState(body);
  const [mergeId, setMergeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await updateKnowledgeObject({
      id,
      title: nextTitle,
      summary: nextSummary,
      body: nextBody,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11 md:h-8 md:min-h-8" onClick={() => setEditing((value) => !value)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
        {state === "proposed" ? (
          <Button className="min-h-11 md:h-8 md:min-h-8" onClick={() => void setKnowledgeState(id, "active").then(() => window.location.reload())}>
            Accept proposal
          </Button>
        ) : null}
        {state !== "archived" ? (
          <Button variant="outline" className="min-h-11 md:h-8 md:min-h-8" onClick={() => void setKnowledgeState(id, "archived").then(() => window.location.reload())}>
            Archive
          </Button>
        ) : (
          <Button variant="outline" className="min-h-11 md:h-8 md:min-h-8" onClick={() => void setKnowledgeState(id, "active").then(() => window.location.reload())}>
            Restore
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-4 space-y-3">
          <Input value={nextTitle} onChange={(event) => setNextTitle(event.target.value)} />
          <Textarea value={nextSummary} onChange={(event) => setNextSummary(event.target.value)} rows={3} />
          <Textarea value={nextBody} onChange={(event) => setNextBody(event.target.value)} rows={10} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={pending} onClick={() => void save()}>
            Save
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-[17px] leading-7">{summary}</p>
          <Markdown content={body} />
        </div>
      )}
      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void mergeKnowledgeObject(id, mergeId).then((result) => {
            if (result.error) setError(result.error);
            else router.push(`/research/knowledge/${result.targetId}`);
          });
        }}
      >
        <Input
          placeholder="Merge into object id"
          value={mergeId}
          onChange={(event) => setMergeId(event.target.value)}
        />
        <Button type="submit" variant="outline" className="min-h-11 md:h-8 md:min-h-8">
          Merge
        </Button>
      </form>
    </div>
  );
}

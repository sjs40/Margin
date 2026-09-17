"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addOwnedKnowledgeSource, updateKnowledgeSourceRole, removeKnowledgeSource } from "@/features/knowledge/actions";
import type { KnowledgeSourceRole, KnowledgeSourceType } from "@/types/domain";

const ROLES: KnowledgeSourceRole[] = [
  "origin",
  "support",
  "counterevidence",
  "example",
  "counterexample",
  "boundary_condition",
];

export function KnowledgeSourceControls({
  objectId,
}: {
  objectId: string;
}) {
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("note");
  const [sourceId, setSourceId] = useState("");
  const [role, setRole] = useState<KnowledgeSourceRole>("support");
  const [excerpt, setExcerpt] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-4 space-y-2 rounded-lg border border-border p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await addOwnedKnowledgeSource({
          objectId,
          sourceType,
          sourceId,
          role,
          excerpt,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        window.location.reload();
      }}
    >
      <p className="text-sm text-muted-foreground">Add a source relation. Ownership is checked server-side.</p>
      <select
        className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
        value={sourceType}
        onChange={(event) => setSourceType(event.target.value as KnowledgeSourceType)}
      >
        <option value="note">Note</option>
        <option value="document">Document</option>
        <option value="meta_note">Meta note</option>
        <option value="claim">Claim</option>
        <option value="knowledge_object">Knowledge object</option>
      </select>
      <Input placeholder="Source id" value={sourceId} onChange={(event) => setSourceId(event.target.value)} />
      <select
        className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
        value={role}
        onChange={(event) => setRole(event.target.value as KnowledgeSourceRole)}
      >
        {ROLES.map((item) => (
          <option key={item} value={item}>
            {item.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <Textarea placeholder="Excerpt or rationale" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} rows={3} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="min-h-11 md:h-8 md:min-h-8">
        Add source
      </Button>
    </form>
  );
}

export function SourceRoleSelect({
  id,
  role,
}: {
  id: string;
  role: KnowledgeSourceRole;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <select
        className="min-h-11 rounded-md border border-border bg-background px-2 text-sm md:h-8 md:min-h-8"
        defaultValue={role}
        onChange={(event) => {
          void updateKnowledgeSourceRole(id, event.target.value as KnowledgeSourceRole).then(() =>
            window.location.reload(),
          );
        }}
      >
        {ROLES.map((item) => (
          <option key={item} value={item}>
            {item.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        className="min-h-11 md:h-8 md:min-h-8"
        onClick={() => void removeKnowledgeSource(id).then(() => window.location.reload())}
      >
        Remove
      </Button>
    </div>
  );
}

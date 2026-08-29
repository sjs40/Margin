"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importResearchDocument } from "@/features/capture/actions";

export function ImportForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const result = await importResearchDocument(value);
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(result.document ? `/documents/${result.document.id}` : "/");
      }}
    >
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Paste a MetaNote or any Markdown research export…"
        className="min-h-80 font-mono text-sm"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !value.trim()}>
        {pending ? "Importing…" : "Import"}
      </Button>
    </form>
  );
}

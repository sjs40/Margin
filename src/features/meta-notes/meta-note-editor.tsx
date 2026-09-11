"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { saveMetaNoteEdit } from "@/features/meta-notes/actions";

export function MetaNoteEditor({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!editing) {
    return (
      <div>
        <Button
          variant="outline"
          className="mb-4 min-h-11 md:h-8 md:min-h-8"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
        <Markdown content={content} />
      </div>
    );
  }

  return (
    <div>
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-36 resize-y border-0 bg-transparent px-0 text-[17px] leading-7 shadow-none focus-visible:ring-0 md:min-h-44 md:text-lg"
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button
          className="min-h-11 md:h-8 md:min-h-8"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const result = await saveMetaNoteEdit(id, value);
            setPending(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            window.location.reload();
          }}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          className="min-h-11 md:h-8 md:min-h-8"
          onClick={() => {
            setValue(content);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

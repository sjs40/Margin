"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createHandwrittenNote } from "@/features/capture/actions";

export function CameraCapture() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setPending(true);
        setError(null);
        const result = await createHandwrittenNote(data);
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(result.note ? `/notes/${result.note.id}` : "/");
      }}
    >
      <label className="block min-h-64 cursor-pointer rounded-lg border border-dashed border-border p-6 text-center">
        <span className="font-sans text-sm font-medium">Photograph a page</span>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the camera on iPhone, or choose an existing image.
        </p>
        <input
          className="mt-4 block w-full text-sm"
          type="file"
          name="file"
          accept="image/*"
          capture="environment"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected page" className="mx-auto mt-4 max-h-80 rounded-md" />
        ) : null}
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

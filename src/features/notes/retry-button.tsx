"use client";

import { Button } from "@/components/ui/button";
import { retryNote } from "@/features/capture/actions";

export function RetryNoteButton({ noteId }: { noteId: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await retryNote(noteId);
        window.location.reload();
      }}
    >
      Retry
    </Button>
  );
}

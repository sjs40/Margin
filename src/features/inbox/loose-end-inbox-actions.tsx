"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actOnLooseEndInboxItem, searchRecentNotes } from "@/features/research/actions";

export function LooseEndInboxActions({
  inboxItemId,
  kind,
}: {
  inboxItemId: string;
  kind: "question" | "followup";
}) {
  const [form, setForm] = useState<"resolve" | "dismiss" | null>(null);
  const [comment, setComment] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [noteHits, setNoteHits] = useState<Array<{ id: string; title: string | null }>>([]);
  const [pickedNoteId, setPickedNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "return" | "resolve" | "dismiss") {
    setError(null);
    const result = await actOnLooseEndInboxItem({
      inboxItemId,
      action,
      comment,
      resolvedByNoteId: action === "resolve" ? pickedNoteId : null,
    });
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 md:h-8 md:min-h-8" onClick={() => void run("return")}>
          Return to Loose Ends
        </Button>
        <Button
          className="min-h-11 md:h-8 md:min-h-8"
          variant="outline"
          onClick={() => setForm("resolve")}
        >
          {kind === "followup" ? "Complete" : "Resolve"}
        </Button>
        <Button
          className="min-h-11 md:h-8 md:min-h-8"
          variant="ghost"
          onClick={() => setForm("dismiss")}
        >
          Dismiss
        </Button>
      </div>
      {form ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <label className="text-sm text-muted-foreground" htmlFor={`inbox-why-${inboxItemId}`}>
            Why?
          </label>
          <Textarea
            id={`inbox-why-${inboxItemId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
          />
          {form === "resolve" ? (
            <div>
              <Input
                placeholder="Link a resolving note (optional)"
                value={noteQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setNoteQuery(value);
                  void searchRecentNotes(value).then(setNoteHits);
                }}
              />
              {noteHits.length > 0 ? (
                <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                  {noteHits.map((note) => (
                    <li key={note.id}>
                      <button
                        type="button"
                        className="block w-full px-2 py-2 text-left text-sm"
                        onClick={() => {
                          setPickedNoteId(note.id);
                          setNoteQuery(note.title ?? note.id);
                          setNoteHits([]);
                        }}
                      >
                        {note.title || "Untitled note"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 md:h-8 md:min-h-8"
              onClick={() => void run(form === "dismiss" ? "dismiss" : "resolve")}
            >
              Save
            </Button>
            <Button variant="ghost" className="min-h-11 md:h-8 md:min-h-8" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

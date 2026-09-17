"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  createLooseEnd,
  searchRecentNotes,
  sendLooseEndToInbox,
  updateLooseEnd,
  type LooseEndKind,
} from "@/features/research/actions";
import { navigableLooseEndSourceHref, type LooseEndView } from "@/lib/loose-ends";

export type { LooseEndView };

export function LooseEndRow({
  item,
  contextNoteId,
  allowNotePicker = false,
}: {
  item: LooseEndView;
  contextNoteId?: string | null;
  allowNotePicker?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<"resolve" | "dismiss" | "comment" | null>(null);
  const [comment, setComment] = useState(item.resolution_comment ?? "");
  const [noteQuery, setNoteQuery] = useState("");
  const [noteHits, setNoteHits] = useState<Array<{ id: string; title: string | null }>>([]);
  const [pickedNoteId, setPickedNoteId] = useState<string | null>(contextNoteId ?? null);
  const [error, setError] = useState<string | null>(null);
  const sourceHref = navigableLooseEndSourceHref(item.source_href, pathname);

  async function save(status: "resolved" | "dismissed" | "open") {
    setError(null);
    const result = await updateLooseEnd({
      id: item.id,
      kind: item.kind,
      status,
      comment,
      resolvedByNoteId: status === "resolved" ? (pickedNoteId ?? contextNoteId ?? null) : null,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  async function sendToInbox() {
    setError(null);
    setMenuOpen(false);
    const result = await sendLooseEndToInbox({ id: item.id, kind: item.kind });
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  function openForm(next: "resolve" | "dismiss" | "comment") {
    setMenuOpen(false);
    setForm(next);
  }

  const body = (
    <>
      <span className="block">{item.text}</span>
      <LooseEndSourceLine item={item} linked={false} />
    </>
  );

  return (
    <li className="text-sm leading-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {item.kind === "question" ? "Question" : "Follow-up"}
          </span>
          {sourceHref ? (
            <Link
              href={sourceHref}
              className="mt-1 block min-h-11 rounded-md py-2 hover:bg-secondary/40"
            >
              {body}
            </Link>
          ) : (
            <div className="mt-1">{body}</div>
          )}
          {item.resolution_comment ? (
            <p className="mt-1 text-muted-foreground">Why: {item.resolution_comment}</p>
          ) : null}
          {item.resolved_by_note_id ? (
            <Link
              href={`/notes/${item.resolved_by_note_id}`}
              className="inline-flex min-h-11 items-center text-sm underline"
            >
              {item.resolving_note_title || "Resolving note"}
            </Link>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 md:h-8 md:min-h-8"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Actions
        </Button>
      </div>
      {menuOpen ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            className="block min-h-11 w-full px-3 text-left text-sm hover:bg-secondary/40"
            onClick={() => openForm("resolve")}
          >
            {item.kind === "followup" ? "Complete" : "Resolve"}
          </button>
          {item.status === "open" ? (
            <button
              type="button"
              className="block min-h-11 w-full border-t border-border px-3 text-left text-sm hover:bg-secondary/40"
              onClick={() => void sendToInbox()}
            >
              Send to Inbox
            </button>
          ) : null}
          <button
            type="button"
            className="block min-h-11 w-full border-t border-border px-3 text-left text-sm hover:bg-secondary/40"
            onClick={() => openForm("dismiss")}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="block min-h-11 w-full border-t border-border px-3 text-left text-sm hover:bg-secondary/40"
            onClick={() => openForm("comment")}
          >
            Add response
          </button>
        </div>
      ) : null}
      {form ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
          <label className="text-sm text-muted-foreground" htmlFor={`why-${item.id}`}>
            Why?
          </label>
          <Textarea
            id={`why-${item.id}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
          />
          {form === "resolve" && allowNotePicker ? (
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
                        className="block min-h-11 w-full px-2 py-2 text-left text-sm"
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
              onClick={() => void save(form === "dismiss" ? "dismissed" : form === "resolve" ? "resolved" : "open")}
            >
              Save
            </Button>
            <Button variant="ghost" className="min-h-11 md:h-8 md:min-h-8" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}
    </li>
  );
}

export function LooseEndSourceLine({
  item,
  linked = true,
}: {
  item: Pick<LooseEndView, "entity_label" | "theme_name" | "source_title" | "source_href">;
  linked?: boolean;
}) {
  const pathname = usePathname();
  const href = linked ? navigableLooseEndSourceHref(item.source_href, pathname) : null;
  const parts: Array<{ key: string; node: ReactNode }> = [];
  if (item.entity_label) parts.push({ key: "entity", node: item.entity_label });
  if (item.theme_name) parts.push({ key: "theme", node: item.theme_name });
  if (item.source_title) parts.push({ key: "source", node: item.source_title });
  if (parts.length === 0) return null;
  const line = (
    <>
      From:{" "}
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 ? " / " : null}
          {part.node}
        </span>
      ))}
      {" →"}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="mt-1 inline-flex min-h-11 items-center text-sm text-muted-foreground underline"
      >
        {line}
      </Link>
    );
  }
  return <span className="mt-1 block text-sm text-muted-foreground">{line}</span>;
}

export function AddLooseEnd({
  noteId,
  entityId,
  themeId,
}: {
  noteId?: string;
  entityId?: string;
  themeId?: string;
}) {
  const [question, setQuestion] = useState("");
  const [followup, setFollowup] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(kind: LooseEndKind, text: string, clear: () => void) {
    setError(null);
    const result = await createLooseEnd({ kind, text, noteId, entityId, themeId });
    if (result.error) {
      setError(result.error);
      return;
    }
    clear();
    window.location.reload();
  }

  return (
    <div className="mt-3 space-y-2">
      <Input
        placeholder="Add question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void add("question", question, () => setQuestion(""));
          }
        }}
      />
      <Input
        placeholder="Add follow-up"
        value={followup}
        onChange={(event) => setFollowup(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void add("followup", followup, () => setFollowup(""));
          }
        }}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LocalDate } from "@/components/local-datetime";
import {
  createNoteAnnotation,
  deleteNoteAnnotation,
  updateNoteAnnotation,
} from "@/features/notes/annotation-actions";

export type AnnotationView = {
  id: string;
  text: string;
  created_at: string;
  parent_annotation_id: string | null;
};

export function NoteAnnotations({
  noteId,
  annotations,
}: {
  noteId: string;
  annotations: AnnotationView[];
}) {
  const roots = annotations.filter((item) => !item.parent_annotation_id);
  const childrenOf = (id: string) => annotations.filter((item) => item.parent_annotation_id === id);

  return (
    <section className="mt-8">
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Annotations
      </h2>
      <ul className="mt-3 space-y-3">
        {roots.map((item) => (
          <AnnotationItem key={item.id} noteId={noteId} item={item} childrenItems={childrenOf(item.id)} />
        ))}
      </ul>
      <AddAnnotation noteId={noteId} />
    </section>
  );
}

function AnnotationItem({
  noteId,
  item,
  childrenItems,
  canReply = true,
}: {
  noteId: string;
  item: AnnotationView;
  childrenItems: AnnotationView[];
  canReply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [value, setValue] = useState(item.text);

  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <p className="font-mono text-[11px] text-muted-foreground">
        <LocalDate iso={item.created_at} />
      </p>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
          <Button
            className="min-h-11 md:h-8 md:min-h-8"
            onClick={async () => {
              await updateNoteAnnotation(item.id, value);
              window.location.reload();
            }}
          >
            Save
          </Button>
        </div>
      ) : (
        <p className="mt-1">{item.text}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" className="min-h-11 md:h-8 md:min-h-8" onClick={() => setEditing((open) => !open)}>
          Edit
        </Button>
        {canReply ? (
          <Button variant="ghost" className="min-h-11 md:h-8 md:min-h-8" onClick={() => setReplying((open) => !open)}>
            Reply
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="min-h-11 md:h-8 md:min-h-8"
          onClick={async () => {
            await deleteNoteAnnotation(item.id);
            window.location.reload();
          }}
        >
          Delete
        </Button>
      </div>
      {replying ? <AddAnnotation noteId={noteId} parentAnnotationId={item.id} /> : null}
      {childrenItems.length > 0 ? (
        <ul className="mt-3 ml-4 list-disc space-y-2 pl-4">
          {childrenItems.map((child) => (
            <AnnotationItem key={child.id} noteId={noteId} item={child} childrenItems={[]} canReply={false} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function AddAnnotation({
  noteId,
  parentAnnotationId,
}: {
  noteId: string;
  parentAnnotationId?: string;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={parentAnnotationId ? "Reply" : "Add a note under this capture"}
        rows={3}
      />
      <Button
        className="min-h-11 md:h-8 md:min-h-8"
        onClick={async () => {
          await createNoteAnnotation({ noteId, text, parentAnnotationId });
          window.location.reload();
        }}
      >
        Add
      </Button>
    </div>
  );
}

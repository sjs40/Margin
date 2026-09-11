import Link from "next/link";
import { LooseEndRow, type LooseEndView } from "@/features/research/loose-end-row";

export function LooseEnds({
  questions,
  followups,
  href = "/research/loose-ends",
  allowNotePicker = false,
}: {
  questions: LooseEndView[];
  followups: LooseEndView[];
  href?: string;
  allowNotePicker?: boolean;
}) {
  return (
    <aside>
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Link href={href} className="hover:text-foreground">
          Loose Ends
        </Link>
      </h2>
      {questions.length === 0 && followups.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No open questions or follow-ups.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {questions.map((item) => (
            <LooseEndRow key={item.id} item={{ ...item, kind: "question" }} allowNotePicker={allowNotePicker} />
          ))}
          {followups.map((item) => (
            <LooseEndRow key={item.id} item={{ ...item, kind: "followup" }} allowNotePicker={allowNotePicker} />
          ))}
        </ul>
      )}
    </aside>
  );
}

export function mapQuestion(row: {
  id: string;
  question_text: string;
  status: string;
  resolution_comment?: string | null;
  resolved_by_note_id?: string | null;
  note_id?: string | null;
}): LooseEndView {
  return {
    id: row.id,
    kind: "question",
    text: row.question_text,
    status: row.status,
    resolution_comment: row.resolution_comment ?? null,
    resolved_by_note_id: row.resolved_by_note_id ?? null,
    note_id: row.note_id ?? null,
  };
}

export function mapFollowup(row: {
  id: string;
  text: string;
  status: string;
  resolution_comment?: string | null;
  resolved_by_note_id?: string | null;
  note_id?: string | null;
}): LooseEndView {
  return {
    id: row.id,
    kind: "followup",
    text: row.text,
    status: row.status,
    resolution_comment: row.resolution_comment ?? null,
    resolved_by_note_id: row.resolved_by_note_id ?? null,
    note_id: row.note_id ?? null,
  };
}
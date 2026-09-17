import Link from "next/link";
import { LooseEndRow } from "@/features/research/loose-end-row";
import {
  mapFollowupRecord,
  mapQuestionRecord,
  type FollowupRecord,
  type LooseEndView,
  type QuestionRecord,
} from "@/lib/loose-ends";

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
        <Link href={href} className="inline-flex min-h-11 items-center hover:text-foreground">
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

export function mapQuestion(row: QuestionRecord): LooseEndView {
  return mapQuestionRecord(row);
}

export function mapFollowup(row: FollowupRecord): LooseEndView {
  return mapFollowupRecord(row);
}
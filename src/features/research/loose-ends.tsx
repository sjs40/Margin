type Item = { id: string; title?: string; question_text?: string; text?: string };

export function LooseEnds({
  questions,
  followups,
}: {
  questions: Item[];
  followups: Item[];
}) {
  if (questions.length === 0 && followups.length === 0) {
    return (
      <aside>
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Loose Ends
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">No open questions or follow-ups.</p>
      </aside>
    );
  }

  return (
    <aside>
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Loose Ends
      </h2>
      <ul className="mt-4 space-y-4">
        {questions.map((item) => (
          <li key={item.id} className="text-sm leading-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Question
            </span>
            <p className="mt-1">{item.question_text}</p>
          </li>
        ))}
        {followups.map((item) => (
          <li key={item.id} className="text-sm leading-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Follow-up
            </span>
            <p className="mt-1">{item.text}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

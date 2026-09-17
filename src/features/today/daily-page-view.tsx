import { NoteFeed, type FeedNote } from "@/features/notes/note-feed";
import { MetaNoteEditor } from "@/features/meta-notes/meta-note-editor";
import { MetaNoteHistory } from "@/features/meta-notes/meta-note-history";
import { RefreshTodayButton } from "@/features/meta-notes/refresh-today-button";
import { DailyArchiveNav } from "@/features/today/daily-archive-nav";
import { LooseEnds, mapFollowup, mapQuestion } from "@/features/research/loose-ends";
import { CopyContextButton } from "@/features/context/copy-context-button";
import { formatDailyKey } from "@/lib/dates";

type DailyMeta = {
  id: string;
  title: string;
  current_content: string;
  updated_at: string;
};

type Version = {
  id: string;
  version_number: number;
  content: string;
  change_summary: string | null;
};

export function DailyPageView({
  date,
  isToday,
  daily,
  notes,
  previous,
  next,
  questions,
  followups,
  versions = [],
}: {
  date: string;
  isToday: boolean;
  daily: DailyMeta | null;
  notes: FeedNote[];
  previous: string | null;
  next: string | null;
  questions: Parameters<typeof mapQuestion>[0][];
  followups: Parameters<typeof mapFollowup>[0][];
  versions?: Version[];
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">{isToday ? "Today" : formatDailyKey(date)}</h1>
            <div className="mt-2">
              <DailyArchiveNav date={date} previous={previous} next={next} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {daily ? <CopyContextButton seedType="meta_note" seedId={daily.id} /> : null}
            {isToday ? <RefreshTodayButton /> : daily ? <RefreshTodayButton date={date} /> : null}
          </div>
        </div>
        {daily?.current_content ? (
          <article className="mt-6 rounded-lg border border-border p-5">
            <MetaNoteEditor id={daily.id} content={daily.current_content} />
          </article>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            {isToday
              ? "No daily memory yet. Capture notes, then generate today."
              : "No Daily Meta Note is saved for this date."}
          </p>
        )}
        {!isToday && versions.length > 0 && daily ? (
          <MetaNoteHistory currentContent={daily.current_content} versions={versions} />
        ) : null}
        <div className="mt-10">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Notes
          </h2>
          <NoteFeed notes={notes} />
        </div>
      </div>
      {isToday ? (
        <LooseEnds
          questions={questions.map(mapQuestion)}
          followups={followups.map(mapFollowup)}
        />
      ) : (
        <aside>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            That day
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Notes captured this day stay in the feed. Imported documents are not mixed in.
          </p>
        </aside>
      )}
    </div>
  );
}

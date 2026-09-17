import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dailyKey, formatLongDate, parseDailyKey } from "@/lib/dates";

export function DailyArchiveNav({
  date,
  previous,
  next,
}: {
  date: string;
  previous: string | null;
  next: string | null;
}) {
  const today = dailyKey();
  const isToday = date === today;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link
        href={previous ? `/today/${previous}` : "#"}
        aria-disabled={!previous}
        className={`inline-flex min-h-11 items-center gap-1 ${previous ? "text-foreground" : "pointer-events-none text-muted-foreground"}`}
      >
        <ChevronLeft className="size-4" />
        Previous
      </Link>
      <Link
        href={next && next !== today ? `/today/${next}` : next === today ? "/today" : "#"}
        aria-disabled={!next}
        className={`inline-flex min-h-11 items-center gap-1 ${next ? "text-foreground" : "pointer-events-none text-muted-foreground"}`}
      >
        Next
        <ChevronRight className="size-4" />
      </Link>
      <Link href="/today/archive" className="text-muted-foreground underline-offset-4 hover:underline">
        Archive
      </Link>
      {isToday ? null : (
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {formatLongDate(parseDailyKey(date).toISOString())}
        </span>
      )}
    </div>
  );
}

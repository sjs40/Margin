import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { excerptText, formatDailyKey, formatMonthHeading } from "@/lib/dates";
import { LocalDateTime } from "@/components/local-datetime";
import { groupArchiveByMonth } from "@/lib/daily-archive";

export default async function TodayArchivePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: rows } = await supabase
    .from("meta_notes")
    .select("id, date, title, current_content, updated_at")
    .eq("user_id", auth.user.id)
    .eq("meta_type", "daily")
    .not("date", "is", null)
    .order("date", { ascending: false });
  const archive = groupArchiveByMonth(
    (rows ?? []).flatMap((row) =>
      row.date
        ? [
            {
              id: row.id,
              date: row.date,
              title: row.title,
              current_content: row.current_content,
              updated_at: row.updated_at,
            },
          ]
        : [],
    ),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Link href="/today">Today</Link>
        {" / "}
        Archive
      </p>
      <h1 className="mt-2 font-serif text-3xl">Daily Archive</h1>
      {archive.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No Daily Meta Notes yet. Capture notes and generate Today; past days will collect here.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {archive.map((group) => (
            <section key={group.month}>
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {formatMonthHeading(`${group.month}-01`)}
              </h2>
              <ul className="mt-4 divide-y divide-border">
                {group.items.map((item) => (
                  <li key={item.id} className="py-4">
                    <Link href={`/today/${item.date}`} className="block">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {item.date}
                      </p>
                      <p className="mt-1">{item.title || formatDailyKey(item.date)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {excerptText(item.current_content)}
                      </p>
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                        Updated <LocalDateTime iso={item.updated_at} />
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

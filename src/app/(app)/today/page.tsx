import { createClient } from "@/lib/supabase/server";
import { NoteFeed } from "@/features/notes/note-feed";
import { MetaNoteEditor } from "@/features/meta-notes/meta-note-editor";
import { RefreshTodayButton } from "@/features/meta-notes/refresh-today-button";
import { LooseEnds, mapFollowup, mapQuestion } from "@/features/research/loose-ends";
import { startOfDayIso } from "@/lib/dates";
import { dailyKey } from "@/lib/dates";
import type { FeedNote } from "@/features/notes/note-feed";
import { LOOSE_END_SELECT } from "@/lib/loose-ends";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const day = dailyKey();
  const [{ data: notes }, { data: daily }, { data: questions }, { data: followups }] =
    await Promise.all([
      supabase
        .from("notes")
        .select("*, note_links(url, title), note_annotations(id)")
        .eq("user_id", auth.user.id)
        .gte("captured_at", startOfDayIso())
        .order("captured_at", { ascending: false }),
      supabase
        .from("meta_notes")
        .select("*")
        .eq("user_id", auth.user.id)
        .eq("meta_type", "daily")
        .eq("date", day)
        .maybeSingle(),
      supabase
        .from("questions")
        .select(LOOSE_END_SELECT)
        .eq("user_id", auth.user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("followups")
        .select(LOOSE_END_SELECT)
        .eq("user_id", auth.user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-serif text-3xl">Today</h1>
          <RefreshTodayButton />
        </div>
        {daily?.current_content ? (
          <article className="mt-6 rounded-lg border border-border p-5">
            <MetaNoteEditor id={daily.id} content={daily.current_content} />
          </article>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            No daily memory yet. Capture notes, then generate today.
          </p>
        )}
        <div className="mt-10">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Notes
          </h2>
          <NoteFeed notes={(notes ?? []) as FeedNote[]} />
        </div>
      </div>
      <LooseEnds
        questions={(questions ?? []).map(mapQuestion)}
        followups={(followups ?? []).map(mapFollowup)}
      />
    </div>
  );
}

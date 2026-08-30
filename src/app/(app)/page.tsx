import { CaptureBox } from "@/features/capture/capture-box";
import { NoteFeed } from "@/features/notes/note-feed";
import { createClient } from "@/lib/supabase/server";
import { startOfDayIso } from "@/lib/dates";
import type { FeedNote } from "@/features/notes/note-feed";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = auth.user
    ? await supabase
        .from("notes")
        .select("*, note_links(url, title)")
        .eq("user_id", auth.user.id)
        .gte("captured_at", startOfDayIso())
        .order("captured_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl">
      <CaptureBox />
      <div className="mt-10">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Today
        </h2>
        <NoteFeed notes={(data ?? []) as FeedNote[]} />
      </div>
    </div>
  );
}

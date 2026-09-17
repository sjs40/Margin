import { createClient } from "@/lib/supabase/server";
import { dailyKey, endOfDayIso, parseDailyKey, startOfDayIso } from "@/lib/dates";
import { neighboringDailyKeys } from "@/lib/daily-archive";
import type { FeedNote } from "@/features/notes/note-feed";

export async function loadDailyPage(date: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const isToday = date === dailyKey();
  const dayDate = parseDailyKey(date);
  let notesQuery = supabase
    .from("notes")
    .select("*, note_links(url, title), note_annotations(id)")
    .eq("user_id", auth.user.id)
    .gte("captured_at", startOfDayIso(dayDate))
    .order("captured_at", { ascending: false });
  if (!isToday) {
    notesQuery = notesQuery.lte("captured_at", endOfDayIso(dayDate));
  }
  const [
    { data: notes },
    { data: daily },
    { data: questions },
    { data: followups },
    { data: archiveDates },
  ] = await Promise.all([
    notesQuery,
    supabase
      .from("meta_notes")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("meta_type", "daily")
      .eq("date", date)
      .maybeSingle(),
    isToday
      ? supabase
          .from("questions")
          .select("*")
          .eq("user_id", auth.user.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    isToday
      ? supabase
          .from("followups")
          .select("*")
          .eq("user_id", auth.user.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    supabase
      .from("meta_notes")
      .select("date")
      .eq("user_id", auth.user.id)
      .eq("meta_type", "daily")
      .not("date", "is", null)
      .order("date", { ascending: true }),
  ]);
  const dates = (archiveDates ?? [])
    .map((row) => row.date)
    .filter((value): value is string => Boolean(value));
  const neighbors = neighboringDailyKeys(dates, date);
  const versions = daily
    ? await supabase
        .from("meta_note_versions")
        .select("id, version_number, content, change_summary")
        .eq("meta_note_id", daily.id)
        .order("version_number", { ascending: false })
    : { data: [] };
  return {
    isToday,
    daily,
    notes: (notes ?? []) as FeedNote[],
    questions: questions ?? [],
    followups: followups ?? [],
    previous: neighbors.previous,
    next: neighbors.next,
    versions: versions.data ?? [],
  };
}

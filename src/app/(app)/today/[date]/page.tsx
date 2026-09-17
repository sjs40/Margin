import { notFound, redirect } from "next/navigation";
import { DailyPageView } from "@/features/today/daily-page-view";
import { loadDailyPage } from "@/features/today/load-daily-page";
import { dailyKey, isValidDailyKey } from "@/lib/dates";

export default async function ArchivedTodayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDailyKey(date)) notFound();
  if (date === dailyKey()) redirect("/today");
  const data = await loadDailyPage(date);
  if (!data) return null;
  if (!data.daily) notFound();
  return (
    <DailyPageView
      date={date}
      isToday={false}
      daily={data.daily}
      notes={data.notes}
      previous={data.previous}
      next={data.next}
      questions={[]}
      followups={[]}
      versions={data.versions}
    />
  );
}

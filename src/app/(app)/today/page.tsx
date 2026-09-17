import { DailyPageView } from "@/features/today/daily-page-view";
import { loadDailyPage } from "@/features/today/load-daily-page";
import { dailyKey } from "@/lib/dates";

export default async function TodayPage() {
  const data = await loadDailyPage(dailyKey());
  if (!data) return null;
  return (
    <DailyPageView
      date={dailyKey()}
      isToday
      daily={data.daily}
      notes={data.notes}
      previous={data.previous}
      next={data.next}
      questions={data.questions}
      followups={data.followups}
    />
  );
}

export type DailyArchiveRow = {
  id: string;
  date: string;
  title: string;
  current_content: string;
  updated_at: string;
};

export function neighboringDailyKeys(
  dates: string[],
  current: string,
): { previous: string | null; next: string | null } {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  const index = unique.indexOf(current);
  if (index < 0) {
    const earlier = unique.filter((date) => date < current);
    const later = unique.filter((date) => date > current);
    return {
      previous: earlier.at(-1) ?? null,
      next: later[0] ?? null,
    };
  }
  return {
    previous: unique[index - 1] ?? null,
    next: unique[index + 1] ?? null,
  };
}

export function groupArchiveByMonth(rows: DailyArchiveRow[]): Array<{ month: string; items: DailyArchiveRow[] }> {
  const groups = new Map<string, DailyArchiveRow[]>();
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  for (const row of sorted) {
    const month = row.date.slice(0, 7);
    const list = groups.get(month) ?? [];
    list.push(row);
    groups.set(month, list);
  }
  return [...groups.entries()].map(([month, items]) => ({ month, items }));
}

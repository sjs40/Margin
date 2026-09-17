export function dailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDailyKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year == null || month == null || day == null) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseDailyKey(value: string): Date {
  if (!isValidDailyKey(value)) {
    throw new Error(`Invalid daily key: ${value}`);
  }
  return new Date(`${value}T12:00:00.000Z`);
}

export function formatMonthHeading(daily: string): string {
  const date = parseDailyKey(daily);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function excerptText(value: string, limit = 160): string {
  const plain = value.replace(/[#>*_`\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= limit) return plain;
  return `${plain.slice(0, limit).trim()}…`;
}

export function startOfDayIso(date = new Date()): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

export function endOfDayIso(date = new Date()): string {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

/** Normalize Postgres / PostgREST timestamptz strings so Date keeps the real minute. */
export function parseTimestamp(value: string): Date {
  const trimmed = value.trim();
  if (isValidDailyKey(trimmed)) return parseDailyKey(trimmed);
  const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const truncatedFraction = withT.replace(/(\.\d{3})\d+/, "$1");
  const hasZone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(truncatedFraction);
  const normalized = hasZone ? truncatedFraction : `${truncatedFraction}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return parsed;
}

export function formatCapturedAt(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(parseTimestamp(iso));
}

export function formatLongDate(iso: string, timeZone?: string): string {
  const daily = isValidDailyKey(iso.trim());
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone ?? (daily ? "UTC" : undefined),
  }).format(parseTimestamp(iso));
}

export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(parseTimestamp(iso));
}

export function formatDailyKey(daily: string): string {
  return formatLongDate(daily, "UTC");
}

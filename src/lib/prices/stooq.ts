import type { PriceQuote } from "@/lib/prices/types";

export function stooqSymbol(ticker: string): string {
  return `${ticker.trim().toLowerCase().replace(/\./g, "-")}.us`;
}

export function parseStooqCsv(csv: string, ticker: string): PriceQuote | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0]!.split(",");
  const row = lines[1]!.split(",");
  const closeIdx = header.findIndex((cell) => cell.trim().toLowerCase() === "close");
  const dateIdx = header.findIndex((cell) => cell.trim().toLowerCase() === "date");
  const timeIdx = header.findIndex((cell) => cell.trim().toLowerCase() === "time");
  const close = Number(row[closeIdx] ?? row[6]);
  if (!Number.isFinite(close) || close <= 0) return null;
  const date = (row[dateIdx] ?? row[1] ?? "").trim();
  const time = (row[timeIdx] ?? row[2] ?? "16:00:00").trim();
  const asOf = Number.isNaN(Date.parse(`${date}T${time}Z`)) ? new Date().toISOString() : new Date(`${date}T${time}Z`).toISOString();
  return {
    ticker: ticker.toUpperCase(),
    price: close,
    currency: "USD",
    asOf,
    provider: "stooq",
  };
}

export async function fetchStooqQuote(
  ticker: string,
  options?: { timeoutMs?: number; revalidateSeconds?: number | false },
): Promise<PriceQuote | null> {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol(ticker))}&f=sd2t2ohlcv&h&e=csv`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
      cache: options?.revalidateSeconds === false ? "no-store" : undefined,
      next: typeof options?.revalidateSeconds === "number" ? { revalidate: options.revalidateSeconds } : undefined,
    } as RequestInit);
    if (!response.ok) return null;
    return parseStooqCsv(await response.text(), ticker);
  } catch {
    return null;
  }
}

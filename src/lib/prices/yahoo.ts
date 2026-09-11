import type { PriceQuote } from "@/lib/prices/types";

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: unknown;
        regularMarketTime?: unknown;
        currency?: unknown;
        symbol?: unknown;
      };
    }>;
  };
};

export function parseYahooChart(payload: unknown, ticker: string): PriceQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const meta = (payload as YahooChart).chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = Number(meta.regularMarketPrice);
  const time = Number(meta.regularMarketTime);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(time) || time <= 0) return null;
  const currency = typeof meta.currency === "string" && meta.currency ? meta.currency : "USD";
  return {
    ticker: ticker.toUpperCase(),
    price,
    currency,
    asOf: new Date(time * 1000).toISOString(),
    provider: "yahoo",
  };
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchYahooQuote(
  ticker: string,
  options?: { timeoutMs?: number; revalidateSeconds?: number | false },
): Promise<PriceQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
      cache: options?.revalidateSeconds === false ? "no-store" : undefined,
      next: typeof options?.revalidateSeconds === "number" ? { revalidate: options.revalidateSeconds } : undefined,
    } as RequestInit);
    if (!response.ok) return null;
    return parseYahooChart(await response.json(), ticker);
  } catch {
    return null;
  }
}

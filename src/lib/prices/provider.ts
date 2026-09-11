import { priceProvider } from "@/lib/env";
import { fetchStooqQuote } from "@/lib/prices/stooq";
import { fetchYahooQuote } from "@/lib/prices/yahoo";
import type { PriceProviderName, PriceQuote } from "@/lib/prices/types";

export type QuoteFetchOptions = {
  timeoutMs?: number;
  revalidateSeconds?: number | false;
};

const FETCHERS = {
  yahoo: fetchYahooQuote,
  stooq: fetchStooqQuote,
} as const;

export function providerChain(start: PriceProviderName = priceProvider()): Array<"yahoo" | "stooq"> {
  if (start === "none") return [];
  if (start === "stooq") return ["stooq", "yahoo"];
  return ["yahoo", "stooq"];
}

export async function fetchQuote(
  ticker: string,
  options?: QuoteFetchOptions,
): Promise<PriceQuote | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return null;
  for (const name of providerChain()) {
    const quote = await FETCHERS[name](symbol, options);
    if (quote) return quote;
  }
  return null;
}

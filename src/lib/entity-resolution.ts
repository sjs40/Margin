import { isAmbiguousTickerToken, lookupTicker, type KnownTicker } from "@/lib/tickers";

export type ExtractedCompany = {
  name: string | null;
  ticker: string | null;
  confidence: number;
};

export type ResolvedEntity = {
  ticker: string | null;
  canonicalName: string;
  aliases: string[];
  confidence: number;
  ambiguous: boolean;
  reason: string;
};

const TICKER_RE = /\b[A-Z]{1,5}\b/g;
const STOP_WORDS = new Set([
  "A", "I", "THE", "AND", "OR", "TO", "FOR", "ON", "IN", "OF", "AT", "BY",
  "VS", "GMV", "ADS", "REV", "AI", "AV", "EV", "CEO", "CFO", "EPS", "GAAP",
]);

export function extractTickerTokens(text: string): string[] {
  return Array.from(text.matchAll(TICKER_RE), (match) => match[0]).filter(
    (token) => !STOP_WORDS.has(token) || lookupTicker(token),
  );
}

export function sourceSupportsTicker(text: string, ticker: string): boolean {
  const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`\\b${escaped}\\b`);
  if (!exact.test(text)) return false;
  if (!isAmbiguousTickerToken(ticker)) return true;
  const upperExact = new RegExp(`\\b${escaped}\\b`);
  const lower = new RegExp(`\\b${ticker.toLowerCase()}\\b`);
  const hasUpper = upperExact.test(text);
  const hasLower = lower.test(text);
  return hasUpper && !hasLower;
}

export function resolveCompanyCandidate(
  candidate: ExtractedCompany,
  sourceText: string,
): ResolvedEntity | null {
  const ticker = candidate.ticker?.trim().toUpperCase() || null;
  const known: KnownTicker | undefined = ticker ? lookupTicker(ticker) : undefined;
  const confidence = candidate.confidence;

  if (ticker && isAmbiguousTickerToken(ticker)) {
    const supported = sourceSupportsTicker(sourceText, ticker);
    if (!supported || confidence < 0.8) {
      return {
        ticker,
        canonicalName: known?.name ?? candidate.name ?? ticker,
        aliases: known?.aliases ?? [],
        confidence,
        ambiguous: true,
        reason: "Ambiguous short ticker requires capitalization and high confidence.",
      };
    }
  }

  if (ticker && known) {
    return {
      ticker,
      canonicalName: known.name,
      aliases: known.aliases,
      confidence: Math.max(confidence, 0.9),
      ambiguous: false,
      reason: "Mapped from known ticker dictionary.",
    };
  }

  if (ticker && confidence >= 0.75) {
    return {
      ticker,
      canonicalName: candidate.name ?? ticker,
      aliases: candidate.name ? [candidate.name] : [],
      confidence,
      ambiguous: confidence < 0.85,
      reason: "Model-proposed ticker without dictionary match.",
    };
  }

  if (!ticker && candidate.name && confidence >= 0.8) {
    return {
      ticker: null,
      canonicalName: candidate.name,
      aliases: [],
      confidence,
      ambiguous: false,
      reason: "Named company without ticker.",
    };
  }

  return null;
}

export function resolveCompanies(
  candidates: ExtractedCompany[],
  sourceText: string,
): { resolved: ResolvedEntity[]; ambiguous: ResolvedEntity[] } {
  const resolved: ResolvedEntity[] = [];
  const ambiguous: ResolvedEntity[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const result = resolveCompanyCandidate(candidate, sourceText);
    if (!result) continue;
    const key = `${result.ticker ?? ""}:${result.canonicalName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (result.ambiguous) ambiguous.push(result);
    else resolved.push(result);
  }

  return { resolved, ambiguous };
}

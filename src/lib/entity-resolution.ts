import {
  extractCashtags,
  isAmbiguousTickerToken,
  lookupCompanyByName,
  lookupTicker,
  normalizeCompanyName,
  pickNameMatch,
  type KnownTicker,
} from "@/lib/tickers";

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

export type TickerUniverse = {
  byTicker: (ticker: string) => Promise<KnownTicker | undefined> | KnownTicker | undefined;
  byName: (name: string) => Promise<KnownTicker | undefined> | KnownTicker | undefined;
};

const TICKER_RE = /\b[A-Z]{1,5}\b/g;
const STOP_WORDS = new Set([
  "A", "I", "THE", "AND", "OR", "TO", "FOR", "ON", "IN", "OF", "AT", "BY",
  "VS", "GMV", "ADS", "REV", "AI", "AV", "EV", "CEO", "CFO", "EPS", "GAAP",
]);

export function memoryUniverse(rows: KnownTicker[]): TickerUniverse {
  return {
    byTicker(ticker) {
      const key = ticker.trim().toUpperCase();
      return rows.find(
        (row) =>
          row.ticker === key ||
          row.aliases.some((alias) => alias.trim().toUpperCase() === key),
      );
    },
    byName(name) {
      return pickNameMatch(rows, name);
    },
  };
}

export function dbUniverse(): TickerUniverse {
  return {
    byTicker: lookupTicker,
    byName: lookupCompanyByName,
  };
}

export function extractTickerTokens(text: string, knownTickers: Iterable<string> = []): string[] {
  const known = new Set(Array.from(knownTickers, (ticker) => ticker.toUpperCase()));
  return Array.from(text.matchAll(TICKER_RE), (match) => match[0]).filter(
    (token) => !STOP_WORDS.has(token) || known.has(token),
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

export async function resolveCompanyCandidate(
  candidate: ExtractedCompany,
  sourceText: string,
  universe: TickerUniverse = dbUniverse(),
  options: { cashtag?: boolean } = {},
): Promise<ResolvedEntity | null> {
  const ticker = candidate.ticker?.trim().toUpperCase() || null;
  const known = ticker ? await universe.byTicker(ticker) : undefined;
  const confidence = candidate.confidence;
  const named = candidate.name?.trim() || null;

  if (ticker && options.cashtag) {
    if (known) {
      return {
        ticker: known.ticker,
        canonicalName: known.name,
        aliases: known.aliases,
        confidence: 1,
        ambiguous: false,
        reason: "User cashtag.",
      };
    }
    return {
      ticker,
      canonicalName: named ?? ticker,
      aliases: named ? [named] : [],
      confidence: 1,
      ambiguous: true,
      reason: "Cashtag is not in the SEC universe.",
    };
  }

  if (ticker && isAmbiguousTickerToken(ticker)) {
    const supported = sourceSupportsTicker(sourceText, ticker);
    if (!supported || confidence < 0.8) {
      return {
        ticker,
        canonicalName: known?.name ?? named ?? ticker,
        aliases: known?.aliases ?? [],
        confidence,
        ambiguous: true,
        reason: "Ambiguous short ticker requires capitalization and high confidence.",
      };
    }
  }

  if (ticker && known) {
    return {
      ticker: known.ticker,
      canonicalName: known.name,
      aliases: known.aliases,
      confidence: Math.max(confidence, 0.9),
      ambiguous: false,
      reason: "Mapped from SEC ticker universe.",
    };
  }

  const nameQuery = named ?? "";
  const namedMatch = nameQuery ? await universe.byName(nameQuery) : undefined;
  if (namedMatch) {
    return {
      ticker: namedMatch.ticker,
      canonicalName: namedMatch.name,
      aliases: namedMatch.aliases,
      confidence: Math.max(confidence, 0.9),
      ambiguous: false,
      reason: "Mapped from company name.",
    };
  }

  if (ticker && !known) {
    return {
      ticker,
      canonicalName: named ?? ticker,
      aliases: named ? [named] : [],
      confidence,
      ambiguous: true,
      reason: "Unknown ticker is not in the SEC universe.",
    };
  }

  if (!ticker && named && confidence >= 0.8) {
    return {
      ticker: null,
      canonicalName: named,
      aliases: [],
      confidence,
      ambiguous: false,
      reason: "Named company without ticker.",
    };
  }

  return null;
}

export async function resolveCompanies(
  candidates: ExtractedCompany[],
  sourceText: string,
  universe: TickerUniverse = dbUniverse(),
): Promise<{ resolved: ResolvedEntity[]; ambiguous: ResolvedEntity[] }> {
  const resolved: ResolvedEntity[] = [];
  const ambiguous: ResolvedEntity[] = [];
  const seen = new Set<string>();

  const remember = (result: ResolvedEntity) => {
    const key = `${result.ticker ?? ""}:${normalizeCompanyName(result.canonicalName)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (result.ambiguous) ambiguous.push(result);
    else resolved.push(result);
  };

  for (const ticker of extractCashtags(sourceText)) {
    const result = await resolveCompanyCandidate(
      { name: null, ticker, confidence: 1 },
      sourceText,
      universe,
      { cashtag: true },
    );
    if (result) remember(result);
  }

  for (const candidate of candidates) {
    const result = await resolveCompanyCandidate(candidate, sourceText, universe);
    if (result) remember(result);
  }

  return { resolved, ambiguous };
}

import { createAdminClient } from "@/lib/supabase/admin";

export type KnownTicker = {
  id?: string;
  ticker: string | null;
  name: string;
  aliases: string[];
  exchange?: string | null;
  cik?: string | null;
  source?: "sec" | "user";
};

type CacheEntry = {
  value: KnownTicker | undefined;
  expires: number;
};

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const cache = new Map<string, CacheEntry>();

export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'/]/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|ltd|llc|plc|co|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function asAliasList(aliases: unknown): string[] {
  if (!Array.isArray(aliases)) return [];
  return aliases.filter((item): item is string => typeof item === "string");
}

export function pickNameMatch(rows: KnownTicker[], query: string): KnownTicker | undefined {
  const needle = normalizeCompanyName(query);
  if (!needle) return undefined;

  const exact = rows.filter((row) => {
    if (normalizeCompanyName(row.name) === needle) return true;
    return row.aliases.some((alias) => normalizeCompanyName(alias) === needle);
  });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;

  if (needle.length < 4) return undefined;

  const fuzzy = rows.filter((row) => {
    const name = normalizeCompanyName(row.name);
    if (name.startsWith(`${needle} `) || name.endsWith(` ${needle}`) || name.includes(` ${needle} `)) {
      return true;
    }
    return row.aliases.some((alias) => {
      const normalized = normalizeCompanyName(alias);
      return (
        normalized === needle ||
        normalized.startsWith(`${needle} `) ||
        normalized.endsWith(` ${needle}`)
      );
    });
  });
  if (fuzzy.length === 1) return fuzzy[0];
  return undefined;
}

function cacheGet(key: string): CacheEntry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: KnownTicker | undefined) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

export function clearTickerCache() {
  cache.clear();
}

function mapRow(row: {
  id: string;
  ticker: string | null;
  canonical_name: string;
  aliases: unknown;
  exchange?: string | null;
  cik?: string | null;
  source?: string | null;
}): KnownTicker {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.canonical_name,
    aliases: asAliasList(row.aliases),
    exchange: row.exchange ?? null,
    cik: row.cik ?? null,
    source: row.source === "sec" || row.source === "user" ? row.source : "user",
  };
}

export async function lookupTicker(ticker: string): Promise<KnownTicker | undefined> {
  const key = normalizeTicker(ticker);
  if (!key) return undefined;
  const cached = cacheGet(`t:${key}`);
  if (cached) return cached.value;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("lookup_company", { q: key });
  if (error) {
    cacheSet(`t:${key}`, undefined);
    return undefined;
  }
  const row = Array.isArray(data) ? data[0] : data;
  const mapped = row ? mapRow(row) : undefined;
  cacheSet(`t:${key}`, mapped);
  return mapped;
}

export async function lookupCompanyByName(name: string): Promise<KnownTicker | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const cacheKey = `n:${normalizeCompanyName(trimmed)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached.value;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("search_companies_by_name", { q: trimmed });
  if (error) {
    cacheSet(cacheKey, undefined);
    return undefined;
  }
  const rows = (data ?? []).map((row: Parameters<typeof mapRow>[0]) => mapRow(row));
  const picked = pickNameMatch(rows, trimmed);
  cacheSet(cacheKey, picked);
  return picked;
}

export async function searchCompanies(query: string, limit = 8): Promise<KnownTicker[]> {
  const q = query.trim();
  if (!q) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("search_companies", { q, lim: limit });
  if (error) return [];
  return (data ?? []).map((row: Parameters<typeof mapRow>[0]) => mapRow(row));
}

const AMBIGUOUS_SHORT_TICKERS = new Set(["ON", "OR", "IT", "ALL", "A", "T", "C", "F", "GM", "SO"]);

export function isAmbiguousTickerToken(ticker: string): boolean {
  return AMBIGUOUS_SHORT_TICKERS.has(ticker.toUpperCase()) || ticker.length <= 2;
}

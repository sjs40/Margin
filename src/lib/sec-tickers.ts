import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { secUserAgent } from "@/lib/env";
import { asAliasList, clearTickerCache, normalizeTicker } from "@/lib/tickers";

export type SecCompanyRow = {
  ticker: string;
  name: string;
  cik: string;
  exchange: string | null;
};

const BATCH_SIZE = 500;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const EXCHANGE_URL = "https://www.sec.gov/files/company_tickers_exchange.json";

export function shouldSkipWeeklySync(lastSyncedAt: string | null | undefined, now = new Date()): boolean {
  if (!lastSyncedAt) return false;
  const then = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then < WEEK_MS;
}

export function chunkRows<T>(rows: T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export function parseCompanyTickersJson(data: unknown): SecCompanyRow[] {
  if (!data || typeof data !== "object") return [];
  const rows: SecCompanyRow[] = [];
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const row = value as { ticker?: unknown; title?: unknown; cik_str?: unknown };
    const ticker = typeof row.ticker === "string" ? normalizeTicker(row.ticker) : "";
    const name = typeof row.title === "string" ? row.title.trim() : "";
    if (!ticker || !name) continue;
    rows.push({
      ticker,
      name,
      cik: row.cik_str != null ? String(row.cik_str) : "",
      exchange: null,
    });
  }
  return rows;
}

export function parseCompanyTickersExchangeJson(data: unknown): SecCompanyRow[] {
  if (!data || typeof data !== "object") return [];
  const payload = data as { fields?: unknown; data?: unknown };
  if (!Array.isArray(payload.fields) || !Array.isArray(payload.data)) return [];
  const fields = payload.fields.map((field) => String(field));
  const cikIdx = fields.indexOf("cik");
  const nameIdx = fields.indexOf("name");
  const tickerIdx = fields.indexOf("ticker");
  const exchangeIdx = fields.indexOf("exchange");
  if (nameIdx < 0 || tickerIdx < 0) return [];

  const rows: SecCompanyRow[] = [];
  for (const entry of payload.data) {
    if (!Array.isArray(entry)) continue;
    const ticker = typeof entry[tickerIdx] === "string" ? normalizeTicker(entry[tickerIdx] as string) : "";
    const name = typeof entry[nameIdx] === "string" ? String(entry[nameIdx]).trim() : "";
    if (!ticker || !name) continue;
    rows.push({
      ticker,
      name,
      cik: cikIdx >= 0 && entry[cikIdx] != null ? String(entry[cikIdx]) : "",
      exchange: exchangeIdx >= 0 && typeof entry[exchangeIdx] === "string" ? (entry[exchangeIdx] as string) : null,
    });
  }
  return rows;
}

export function mergeSecRows(base: SecCompanyRow[], withExchange: SecCompanyRow[]): SecCompanyRow[] {
  const byTicker = new Map<string, SecCompanyRow>();
  for (const row of base) byTicker.set(row.ticker, row);
  for (const row of withExchange) {
    const existing = byTicker.get(row.ticker);
    byTicker.set(row.ticker, {
      ticker: row.ticker,
      name: row.name || existing?.name || row.ticker,
      cik: row.cik || existing?.cik || "",
      exchange: row.exchange ?? existing?.exchange ?? null,
    });
  }
  return uniquifyCanonicalNames([...byTicker.values()]);
}

export function uniquifyCanonicalNames(rows: SecCompanyRow[]): SecCompanyRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = row.name.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return row;
    return { ...row, name: `${row.name} (${row.ticker})` };
  });
}

async function fetchJson(url: string, userAgent: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`SEC fetch failed ${response.status} for ${url}`);
  }
  return response.json();
}

export type SecSyncResult = {
  skipped: boolean;
  upserted: number;
  reason?: string;
};

export async function syncSecTickerUniverse(options: { force?: boolean } = {}): Promise<SecSyncResult> {
  const userAgent = secUserAgent();
  if (!userAgent) {
    logger.warn("sec_ticker_sync_skipped", { reason: "missing_user_agent" });
    return { skipped: true, upserted: 0, reason: "missing_user_agent" };
  }

  const supabase = createAdminClient();
  if (!options.force) {
    const { data: recent } = await supabase
      .from("entities")
      .select("last_synced_at")
      .eq("source", "sec")
      .not("last_synced_at", "is", null)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (shouldSkipWeeklySync(recent?.last_synced_at ?? null)) {
      logger.info("sec_ticker_sync_skipped", { reason: "fresh" });
      return { skipped: true, upserted: 0, reason: "fresh" };
    }
  }

  const tickersJson = await fetchJson(TICKERS_URL, userAgent);
  let exchangeJson: unknown = null;
  try {
    exchangeJson = await fetchJson(EXCHANGE_URL, userAgent);
  } catch (error) {
    logger.warn("sec_exchange_fetch_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  const merged = mergeSecRows(
    parseCompanyTickersJson(tickersJson),
    exchangeJson ? parseCompanyTickersExchangeJson(exchangeJson) : [],
  );
  const syncedAt = new Date().toISOString();
  let upserted = 0;

  for (const batch of chunkRows(merged)) {
    const tickers = batch.map((row) => row.ticker);
    const { data: existing } = await supabase
      .from("entities")
      .select("id, ticker, source, aliases")
      .eq("entity_type", "company")
      .in("ticker", tickers);
    const byTicker = new Map(
      (existing ?? []).map((row) => [normalizeTicker(String(row.ticker ?? "")), row]),
    );

    const inserts: Array<Record<string, unknown>> = [];
    const secUpdates: Array<Record<string, unknown>> = [];
    const userUpdates: Array<{ id: string; cik: string | null; exchange: string | null }> = [];

    for (const row of batch) {
      const current = byTicker.get(row.ticker);
      const payload = {
        entity_type: "company",
        canonical_name: row.name,
        ticker: row.ticker,
        cik: row.cik || null,
        exchange: row.exchange,
        source: "sec",
        aliases: [] as string[],
        last_synced_at: syncedAt,
        updated_at: syncedAt,
      };
      if (!current) {
        inserts.push(payload);
        continue;
      }
      if (current.source === "user") {
        userUpdates.push({ id: current.id as string, cik: payload.cik, exchange: payload.exchange });
        continue;
      }
      secUpdates.push({
        id: current.id,
        ...payload,
        aliases: asAliasList(current.aliases),
      });
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("entities").insert(inserts);
      if (error) {
        for (const row of inserts) {
          const { error: oneError } = await supabase.from("entities").insert({
            ...row,
            canonical_name: `${row.canonical_name} (${row.ticker})`,
          });
          if (!oneError) upserted += 1;
        }
      } else {
        upserted += inserts.length;
      }
    }

    if (secUpdates.length > 0) {
      const { error } = await supabase.from("entities").upsert(secUpdates);
      if (!error) upserted += secUpdates.length;
    }

    for (const row of userUpdates) {
      const { error } = await supabase
        .from("entities")
        .update({
          cik: row.cik,
          exchange: row.exchange,
          last_synced_at: syncedAt,
          updated_at: syncedAt,
        })
        .eq("id", row.id);
      if (!error) upserted += 1;
    }
  }

  clearTickerCache();
  logger.info("sec_ticker_sync_completed", { upserted, count: merged.length });
  return { skipped: false, upserted };
}

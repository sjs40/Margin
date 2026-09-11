import { describe, expect, it } from "vitest";
import {
  chunkRows,
  mergeSecRows,
  parseCompanyTickersExchangeJson,
  parseCompanyTickersJson,
  shouldSkipWeeklySync,
  uniquifyCanonicalNames,
} from "@/lib/sec-tickers";

describe("SEC ticker parsers", () => {
  it("parses company_tickers.json objects", () => {
    const rows = parseCompanyTickersJson({
      "0": { cik_str: 320193, ticker: "aapl", title: "Apple Inc." },
      "1": { cik_str: 1045810, ticker: "NVDA", title: "NVIDIA CORP" },
    });
    expect(rows).toEqual([
      { ticker: "AAPL", name: "Apple Inc.", cik: "320193", exchange: null },
      { ticker: "NVDA", name: "NVIDIA CORP", cik: "1045810", exchange: null },
    ]);
  });

  it("parses company_tickers_exchange.json rows", () => {
    const rows = parseCompanyTickersExchangeJson({
      fields: ["cik", "name", "ticker", "exchange"],
      data: [[104181, "Navitas Semiconductor Corp", "NVTS", "Nasdaq"]],
    });
    expect(rows[0]).toEqual({
      ticker: "NVTS",
      name: "Navitas Semiconductor Corp",
      cik: "104181",
      exchange: "Nasdaq",
    });
  });

  it("merges exchange onto the ticker list and suffixes duplicate names", () => {
    const merged = mergeSecRows(
      [{ ticker: "BRK.A", name: "Berkshire Hathaway", cik: "1", exchange: null }],
      [
        { ticker: "BRK.A", name: "Berkshire Hathaway", cik: "1", exchange: "NYSE" },
        { ticker: "BRK.B", name: "Berkshire Hathaway", cik: "1", exchange: "NYSE" },
      ],
    );
    expect(merged.find((row) => row.ticker === "BRK.A")?.exchange).toBe("NYSE");
    expect(merged.find((row) => row.ticker === "BRK.B")?.name).toBe("Berkshire Hathaway (BRK.B)");
  });

  it("skips sync when a sec row was synced within 7 days", () => {
    const now = new Date("2026-09-11T12:00:00Z");
    expect(shouldSkipWeeklySync("2026-09-08T12:00:00Z", now)).toBe(true);
    expect(shouldSkipWeeklySync("2026-09-01T12:00:00Z", now)).toBe(false);
    expect(shouldSkipWeeklySync(null, now)).toBe(false);
  });

  it("chunks upserts into 500-row batches", () => {
    expect(chunkRows(Array.from({ length: 1200 }, (_, i) => i)).map((chunk) => chunk.length)).toEqual([
      500, 500, 200,
    ]);
  });

  it("uniquifies duplicate canonical names", () => {
    const rows = uniquifyCanonicalNames([
      { ticker: "A", name: "Foo", cik: "1", exchange: null },
      { ticker: "B", name: "Foo", cik: "2", exchange: null },
    ]);
    expect(rows[1]?.name).toBe("Foo (B)");
  });
});

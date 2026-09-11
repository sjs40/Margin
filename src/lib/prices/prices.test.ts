import { describe, expect, it } from "vitest";
import { formatCapturePrice, percentChange } from "@/lib/prices/format";
import { providerChain } from "@/lib/prices/provider";
import { parseStooqCsv, stooqSymbol } from "@/lib/prices/stooq";
import { parseYahooChart } from "@/lib/prices/yahoo";

describe("price parsers", () => {
  it("reads yahoo chart meta", () => {
    const quote = parseYahooChart(
      {
        chart: {
          result: [{ meta: { regularMarketPrice: 4.21, regularMarketTime: 1_700_000_000, currency: "USD", symbol: "NVTS" } }],
        },
      },
      "nvts",
    );
    expect(quote?.price).toBe(4.21);
    expect(quote?.provider).toBe("yahoo");
    expect(quote?.ticker).toBe("NVTS");
  });

  it("returns null on yahoo shape mismatch", () => {
    expect(parseYahooChart({ chart: { result: [] } }, "NVTS")).toBeNull();
    expect(parseYahooChart({ chart: { error: "failed" } }, "NVTS")).toBeNull();
  });

  it("parses stooq csv close", () => {
    const csv = "Symbol,Date,Time,Open,High,Low,Close,Volume\nnvts.us,2026-09-11,16:00:00,4,4.2,3.9,4.21,1000\n";
    const quote = parseStooqCsv(csv, "NVTS");
    expect(quote?.price).toBe(4.21);
    expect(quote?.provider).toBe("stooq");
  });

  it("maps share-class tickers to stooq symbols", () => {
    expect(stooqSymbol("BRK.B")).toBe("brk-b.us");
  });
});

describe("price helpers", () => {
  it("formats capture stamps", () => {
    expect(formatCapturePrice("CART", 41.2)).toBe("CART $41.20 at capture");
  });

  it("computes percent change", () => {
    expect(percentChange(5, 4)).toBeCloseTo(25);
    expect(percentChange(4, 0)).toBeNull();
  });

  it("chains providers from the selected start", () => {
    expect(providerChain("yahoo")).toEqual(["yahoo", "stooq"]);
    expect(providerChain("stooq")).toEqual(["stooq", "yahoo"]);
    expect(providerChain("none")).toEqual([]);
  });
});

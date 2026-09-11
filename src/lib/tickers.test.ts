import { describe, expect, it } from "vitest";
import {
  activeCashtagQuery,
  cashtagSegments,
  extractCashtags,
  isAmbiguousTickerToken,
  normalizeCompanyName,
  pickNameMatch,
} from "@/lib/tickers";

describe("ticker helpers", () => {
  it("flags short and reserved tokens as ambiguous", () => {
    expect(isAmbiguousTickerToken("ON")).toBe(true);
    expect(isAmbiguousTickerToken("NVTS")).toBe(false);
  });

  it("does not fuzzy-match very short names", () => {
    expect(
      pickNameMatch(
        [{ ticker: "ON", name: "ON Semiconductor", aliases: ["onsemi"] }],
        "on",
      ),
    ).toBeUndefined();
  });

  it("matches Instacart via alias", () => {
    expect(
      pickNameMatch(
        [{ ticker: "CART", name: "Maplebear", aliases: ["Instacart"] }],
        "Instacart",
      )?.ticker,
    ).toBe("CART");
  });

  it("normalizes punctuation in names", () => {
    expect(normalizeCompanyName("Alphabet, Inc.")).toBe("alphabet");
  });
});

describe("extractCashtags", () => {
  it("extracts cashtags including share classes", () => {
    expect(extractCashtags("bought $ON and $RL plus $BRK.B")).toEqual(["ON", "RL", "BRK.B"]);
  });

  it("ignores prices and magnitudes", () => {
    expect(extractCashtags("sold $NVTS at $6.10 after $61 $4.21 $1.2B $5M $100k")).toEqual(["NVTS"]);
  });

  it("returns NVTS only from a mixed sentence", () => {
    expect(extractCashtags("buy $NVTS at $4")).toEqual(["NVTS"]);
  });

  it("splits cashtag segments for linking", () => {
    const parts = cashtagSegments("sold $NVTS at $6.10", (ticker) =>
      ticker === "NVTS" ? "/research/companies/nvts" : undefined,
    );
    expect(parts.some((part) => part.type === "cashtag" && part.href === "/research/companies/nvts")).toBe(true);
    expect(parts.some((part) => part.value.includes("$6.10") && part.type === "text")).toBe(true);
  });
});

describe("activeCashtagQuery", () => {
  it("reads an in-progress cashtag and ignores dollar amounts", () => {
    expect(activeCashtagQuery("look at $NV", 11)?.query).toBe("NV");
    expect(activeCashtagQuery("worth $61", 9)).toBeNull();
  });
});

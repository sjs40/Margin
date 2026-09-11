import { describe, expect, it } from "vitest";
import { isAmbiguousTickerToken, normalizeCompanyName, pickNameMatch } from "@/lib/tickers";

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

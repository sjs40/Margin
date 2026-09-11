import { describe, expect, it } from "vitest";
import { memoryUniverse, resolveCompanies } from "@/lib/entity-resolution";
import { normalizeCompanyName, pickNameMatch, type KnownTicker } from "@/lib/tickers";

const FIXTURE: KnownTicker[] = [
  { ticker: "CART", name: "Maplebear", aliases: ["Instacart", "Maplebear Inc"] },
  { ticker: "NVTS", name: "Navitas Semiconductor", aliases: ["Navitas"] },
  { ticker: "ON", name: "ON Semiconductor", aliases: ["onsemi", "ON Semi"] },
  { ticker: "POWI", name: "Power Integrations", aliases: ["Power Integrations"] },
  { ticker: "GOOGL", name: "Alphabet", aliases: ["Google", "GOOG"] },
];

const universe = memoryUniverse(FIXTURE);

describe("entity resolution against SEC universe", () => {
  it("maps a known ticker with high confidence", async () => {
    const { resolved } = await resolveCompanies(
      [{ name: null, ticker: "CART", confidence: 0.6 }],
      "CART — incremental margins may matter more than GMV",
      universe,
    );
    expect(resolved[0]?.canonicalName).toBe("Maplebear");
    expect(resolved[0]?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(resolved[0]?.ambiguous).toBe(false);
  });

  it("sends an unknown ticker to inbox and does not resolve an entity", async () => {
    const { resolved, ambiguous } = await resolveCompanies(
      [{ name: "Zyxq Holdings", ticker: "ZZQX", confidence: 0.99 }],
      "ZZQX is going to the moon",
      universe,
    );
    expect(resolved).toHaveLength(0);
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0]?.ticker).toBe("ZZQX");
    expect(ambiguous[0]?.reason).toMatch(/not in the SEC universe/i);
  });

  it("name-matches Navitas to NVTS without a model ticker", async () => {
    const { resolved } = await resolveCompanies(
      [{ name: "Navitas", ticker: null, confidence: 0.85 }],
      "Navitas margins should inflect in 2H",
      universe,
    );
    expect(resolved[0]?.ticker).toBe("NVTS");
    expect(resolved[0]?.canonicalName).toBe("Navitas Semiconductor");
  });

  it("treats an ambiguous short ticker as inbox unless capitalized with high confidence", async () => {
    const weak = await resolveCompanies(
      [{ name: "ON Semiconductor", ticker: "ON", confidence: 0.6 }],
      "This depends on whether demand stays on platform.",
      universe,
    );
    expect(weak.resolved).toHaveLength(0);
    expect(weak.ambiguous.length).toBeGreaterThan(0);

    const strong = await resolveCompanies(
      [{ name: "ON Semiconductor", ticker: "ON", confidence: 0.9 }],
      "ON reported a better mix.",
      universe,
    );
    expect(strong.resolved[0]?.ticker).toBe("ON");
    expect(strong.ambiguous).toHaveLength(0);
  });

  it("still name-matches when the model invents a ticker", async () => {
    const { resolved, ambiguous } = await resolveCompanies(
      [{ name: "Navitas", ticker: "ZZQX", confidence: 0.9 }],
      "Navitas (ZZQX) setup looks interesting",
      universe,
    );
    expect(ambiguous).toHaveLength(0);
    expect(resolved[0]?.ticker).toBe("NVTS");
  });

  it("treats cashtags as authoritative, including $ON", async () => {
    const { resolved, ambiguous } = await resolveCompanies(
      [{ name: null, ticker: "ON", confidence: 0.4 }],
      "bought $ON despite the noise",
      universe,
    );
    expect(ambiguous).toHaveLength(0);
    expect(resolved[0]?.ticker).toBe("ON");
    expect(resolved[0]?.confidence).toBe(1);
  });
});

describe("name matching helpers", () => {
  it("normalizes corporate suffixes", () => {
    expect(normalizeCompanyName("Navitas Semiconductor, Inc.")).toBe("navitas semiconductor");
  });

  it("picks a unique fuzzy name match", () => {
    const match = pickNameMatch(FIXTURE, "Navitas");
    expect(match?.ticker).toBe("NVTS");
  });
});

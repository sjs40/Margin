import { describe, expect, it } from "vitest";
import {
  chunkIds,
  formatMemoryContext,
  groupTickersByOwner,
  hybridScore,
  mergeVectorHits,
  missingVectorIdsBySourceType,
  missingVectorSourceIds,
  tickerEntityScore,
  type RankedHit,
} from "@/lib/ranking";

function hit(overrides: Partial<RankedHit> = {}): RankedHit {
  return {
    id: "n1",
    kind: "note",
    title: "title",
    snippet: "snippet",
    entityScore: 0,
    lexicalScore: 0,
    vectorScore: 0,
    recencyScore: 0,
    ...overrides,
  };
}

describe("hybridScore", () => {
  it("uses semantic-first weights for prose queries", () => {
    const scored = hit({
      entityScore: 1,
      lexicalScore: 1,
      vectorScore: 1,
      recencyScore: 1,
    });
    expect(hybridScore(scored, "supply chain risk")).toBeCloseTo(0.3 + 0.25 + 0.35 + 0.05);
  });

  it("uses entity-first weights for ticker-shaped queries", () => {
    const scored = hit({
      entityScore: 1,
      lexicalScore: 1,
      vectorScore: 1,
      recencyScore: 1,
    });
    expect(hybridScore(scored, "NVTS")).toBeCloseTo(0.7 + 0.15 + 0.1 + 0.05);
  });

  it("lets a high vector score beat a recency-only hit on a semantic query", () => {
    const oldSemantic = hit({
      id: "note-200",
      vectorScore: 0.9,
      recencyScore: 0.25,
    });
    const recentUnrelated = hit({
      id: "recent",
      recencyScore: 1,
    });
    expect(hybridScore(oldSemantic, "gallium nitride power")).toBeGreaterThan(
      hybridScore(recentUnrelated, "gallium nitride power"),
    );
  });
});

describe("mergeVectorHits", () => {
  it("writes similarity onto recency-seeded hits that already exist", () => {
    const merged = mergeVectorHits([hit({ id: "recent", vectorScore: 0 })], [
      { sourceId: "recent", similarity: 0.81 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.vectorScore).toBe(0.81);
  });

  it("keeps the higher similarity when several vectors share a source", () => {
    const merged = mergeVectorHits([hit({ id: "n1", vectorScore: 0.2 })], [
      { sourceId: "n1", similarity: 0.4 },
      { sourceId: "n1", similarity: 0.88 },
    ]);
    expect(merged[0]?.vectorScore).toBe(0.88);
  });

  it("appends fetched vector-only hits that were outside the recency window", () => {
    const recent = hit({ id: "recent", lexicalScore: 0.5, recencyScore: 1 });
    const oldNote = hit({
      id: "note-200",
      lexicalScore: 0,
      recencyScore: 0.25,
      vectorScore: 0,
    });
    const merged = mergeVectorHits(
      [recent],
      [{ sourceId: "note-200", similarity: 0.77 }],
      [oldNote],
    );
    const added = merged.find((row) => row.id === "note-200");
    expect(merged.map((row) => row.id)).toEqual(["recent", "note-200"]);
    expect(added?.vectorScore).toBe(0.77);
    expect(added?.lexicalScore).toBe(0);
    expect(added?.recencyScore).toBe(0.25);
  });

  it("does not duplicate a fetched hit that is already in the array", () => {
    const existing = hit({ id: "n1", vectorScore: 0 });
    const merged = mergeVectorHits(
      [existing],
      [{ sourceId: "n1", similarity: 0.6 }],
      [hit({ id: "n1", vectorScore: 0.1 })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.vectorScore).toBe(0.6);
  });
});

describe("missingVectorSourceIds", () => {
  it("returns unique source ids that are not already hits so they can be fetched", () => {
    expect(
      missingVectorSourceIds(
        [hit({ id: "a" }), hit({ id: "b" })],
        [
          { sourceId: "b", similarity: 0.9 },
          { sourceId: "c", similarity: 0.8 },
          { sourceId: "c", similarity: 0.7 },
          { sourceId: "d", similarity: 0.6 },
        ],
      ),
    ).toEqual(["c", "d"]);
  });
});

describe("missingVectorIdsBySourceType", () => {
  it("splits unmatched vector hits so notes and documents can be fetched in one query each", () => {
    const recent = [hit({ id: "recent-note" })];
    const vectors = [
      { sourceId: "recent-note", sourceType: "note", similarity: 0.5 },
      { sourceId: "note-200", sourceType: "note", similarity: 0.91 },
      { sourceId: "old-doc", sourceType: "document", similarity: 0.8 },
      { sourceId: "daily", sourceType: "meta_note", similarity: 0.7 },
    ];
    expect(missingVectorIdsBySourceType(recent, vectors, "note")).toEqual(["note-200"]);
    expect(missingVectorIdsBySourceType(recent, vectors, "document")).toEqual(["old-doc"]);
    expect(missingVectorIdsBySourceType(recent, vectors, "meta_note")).toEqual(["daily"]);
  });
});

describe("chunkIds", () => {
  it("keeps .in() filters short enough for PostgREST query strings", () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
    expect(chunkIds([], 100)).toEqual([]);
  });
});

describe("tickerEntityScore", () => {
  it("is 1 only for ticker-shaped queries that match a linked ticker", () => {
    expect(tickerEntityScore("NVTS", ["NVTS", "ON"])).toBe(1);
    expect(tickerEntityScore("NVTS", ["CART"])).toBe(0);
    expect(tickerEntityScore("gallium nitride", ["NVTS"])).toBe(0);
  });
});

describe("groupTickersByOwner", () => {
  it("builds a map of unique tickers per note or document id", () => {
    const grouped = groupTickersByOwner([
      { ownerId: "n1", ticker: "NVTS" },
      { ownerId: "n1", ticker: "ON" },
      { ownerId: "n1", ticker: "NVTS" },
      { ownerId: "n2", ticker: null },
      { ownerId: "n3", ticker: "CART" },
    ]);
    expect(grouped.get("n1")).toEqual(["NVTS", "ON"]);
    expect(grouped.has("n2")).toBe(false);
    expect(grouped.get("n3")).toEqual(["CART"]);
  });
});

describe("formatMemoryContext", () => {
  it("includes source ids so Ask can cite notes", () => {
    const context = formatMemoryContext([
      hit({ id: "note-200", kind: "note", title: "GaN thesis", snippet: "old note", date: "2024-01-01" }),
      hit({ id: "doc-1", kind: "document", title: "Import", snippet: "paste" }),
    ]);
    expect(context).toContain("SOURCE id=note-200 kind=note");
    expect(context).toContain("SOURCE id=doc-1 kind=document");
    expect(context).toContain("GaN thesis");
  });
});

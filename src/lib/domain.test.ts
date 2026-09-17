import { describe, expect, it } from "vitest";
import { ParsedNoteSchema } from "@/ai/schemas/parsed-note";
import { memoryUniverse, resolveCompanies } from "@/lib/entity-resolution";
import { normalizeThemeName, pickExistingTheme } from "@/lib/theme-resolution";
import { parseImportedMarkdown } from "@/lib/importer";
import { hybridScore, looksLikeTickerQuery, recencyScore, type RankedHit } from "@/lib/ranking";
import { estimateGenerationCost, roundCost } from "@/lib/cost";
import { chunkDocument } from "@/lib/chunking";
import { dailyKey } from "@/lib/dates";

describe("ParsedNoteSchema", () => {
  it("accepts a conservative short-note parse", () => {
    const parsed = ParsedNoteSchema.parse({
      cleanedText: "NVTS ON POWI",
      title: "NVTS ON POWI",
      noteKind: "quick",
      companies: [
        { name: "Navitas", ticker: "NVTS", confidence: 0.95 },
        { name: "ON Semiconductor", ticker: "ON", confidence: 0.9 },
        { name: "Power Integrations", ticker: "POWI", confidence: 0.95 },
      ],
      themes: [],
      claims: [],
      questions: [],
      followUps: [],
      importance: 0.3,
      overallConfidence: 0.8,
    });
    expect(parsed.claims).toHaveLength(0);
    expect(parsed.candidateInsights).toEqual([]);
    expect(parsed.candidateFrameworks).toEqual([]);
  });
});

describe("entity resolution", () => {
  const universe = memoryUniverse([
    { ticker: "CART", name: "Maplebear", aliases: ["Instacart"] },
    { ticker: "ON", name: "ON Semiconductor", aliases: ["onsemi"] },
  ]);

  it("maps CART to Maplebear", async () => {
    const { resolved } = await resolveCompanies(
      [{ name: null, ticker: "CART", confidence: 0.9 }],
      "CART — incremental margins may matter more than GMV",
      universe,
    );
    expect(resolved[0]?.canonicalName).toBe("Maplebear");
  });

  it("does not treat lowercase on as ticker ON", async () => {
    const { resolved, ambiguous } = await resolveCompanies(
      [{ name: "ON Semiconductor", ticker: "ON", confidence: 0.6 }],
      "This depends on whether demand stays on platform.",
      universe,
    );
    expect(resolved).toHaveLength(0);
    expect(ambiguous.length).toBeGreaterThan(0);
  });
});

describe("theme resolution", () => {
  it("normalizes and prefers an existing theme", () => {
    expect(normalizeThemeName("Owned Consumer Intent")).toBe("owned consumer intent");
    const exact = pickExistingTheme("Owned Consumer Intent", [
      { id: "1", name: "Owned Consumer Intent", normalized_name: "owned consumer intent" },
    ]);
    expect(exact?.name).toBe("Owned Consumer Intent");
    const similar = pickExistingTheme("Owned Traffic", [
      { id: "1", name: "Owned Consumer Intent", normalized_name: "owned consumer intent" },
    ], 0.3);
    expect(similar?.name).toBe("Owned Consumer Intent");
  });
});

describe("markdown importer", () => {
  it("parses YAML frontmatter and sections without requiring the exact schema", () => {
    const imported = parseImportedMarkdown(`---
type: ai_research_session
date: 2026-08-28
companies:
  - UBER
  - GOOGL
source: ChatGPT
---

# Uber and AV Distribution

## Executive synthesis

Distribution matters.

## Open questions

Durability of the advantage.
`);
    expect(imported.title).toBe("Uber and AV Distribution");
    expect(imported.companies).toContain("UBER");
    expect(imported.sections.executiveSynthesis).toContain("Distribution");
    expect(imported.sections.questions).toContain("Durability");
  });

  it("accepts ordinary prose", () => {
    const imported = parseImportedMarkdown("Just a pasted paragraph about UBER.");
    expect(imported.raw).toContain("UBER");
  });
});

describe("ranking", () => {
  it("prioritizes exact ticker matches", () => {
    expect(looksLikeTickerQuery("CART")).toBe(true);
    expect(looksLikeTickerQuery("$NVTS")).toBe(true);
    const tickerHit: RankedHit = {
      id: "1",
      kind: "note",
      title: "CART note",
      snippet: "CART",
      entityScore: 1,
      lexicalScore: 0.2,
      vectorScore: 0.1,
      recencyScore: 0.5,
    };
    const semanticHit: RankedHit = {
      id: "2",
      kind: "note",
      title: "unrelated",
      snippet: "scale",
      entityScore: 0,
      lexicalScore: 0.1,
      vectorScore: 0.9,
      recencyScore: 0.5,
    };
    expect(hybridScore(tickerHit, "CART")).toBeGreaterThan(hybridScore(semanticHit, "CART"));
  });

  it("scores recent notes higher", () => {
    expect(recencyScore(new Date().toISOString())).toBeGreaterThan(recencyScore("2020-01-01"));
  });
});

describe("cost", () => {
  it("estimates flash generation cost", () => {
    expect(roundCost(estimateGenerationCost(1_000_000, 1_000_000))).toBe(4.5);
  });
});

describe("chunking", () => {
  it("keeps headings with chunks", () => {
    const chunks = chunkDocument("# Title\n\nHello\n\n## Section\n\nMore");
    expect(chunks[0]?.heading).toBe("Title");
  });
});

describe("idempotent daily helpers", () => {
  it("uses a stable calendar key", () => {
    const date = new Date("2026-08-28T15:41:00Z");
    expect(dailyKey(date)).toBe("2026-08-28");
  });
});

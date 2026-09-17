import { describe, expect, it } from "vitest";
import {
  canAutoOverwriteKnowledge,
  crossesAutoProposeThreshold,
  evidenceStats,
  fallbackKnowledgeDisposition,
  isExactKnowledgeDuplicate,
  knowledgeFingerprint,
  lexicalKnowledgeOverlap,
} from "@/lib/knowledge";

describe("knowledge fingerprints", () => {
  it("treats equivalent titles and summaries as exact duplicates", () => {
    expect(
      isExactKnowledgeDuplicate(
        { kind: "insight", title: "Gross margin is the tell", summary: "Mix shift beats volume." },
        { kind: "insight", title: "Gross-margin is the tell", summary: "Mix shift beats volume" },
      ),
    ).toBe(true);
    expect(
      knowledgeFingerprint({ kind: "framework", title: "A", summary: "B" }),
    ).not.toBe(knowledgeFingerprint({ kind: "insight", title: "A", summary: "B" }));
  });

  it("does not auto-overwrite user-edited active objects", () => {
    expect(canAutoOverwriteKnowledge({ userEdited: true, origin: "ai", state: "active" })).toBe(false);
    expect(canAutoOverwriteKnowledge({ userEdited: false, origin: "user", state: "active" })).toBe(false);
    expect(canAutoOverwriteKnowledge({ userEdited: false, origin: "ai", state: "proposed" })).toBe(true);
  });

  it("uses a high bar for automatic proposals", () => {
    expect(crossesAutoProposeThreshold(0.81)).toBe(false);
    expect(crossesAutoProposeThreshold(0.82)).toBe(true);
  });
});

describe("knowledge disposition fallback", () => {
  it("keeps exact or high-similarity matches as proposals, not merges", () => {
    expect(
      fallbackKnowledgeDisposition({ exactDuplicate: true, maxLexical: 1, maxVector: 1, entityOverlap: 1 }),
    ).toBe("possible_duplicate");
    expect(
      fallbackKnowledgeDisposition({
        exactDuplicate: false,
        maxLexical: 0.8,
        maxVector: 0.9,
        entityOverlap: 0,
      }),
    ).toBe("possible_duplicate");
  });

  it("classifies weaker overlap as evidence or new", () => {
    expect(
      fallbackKnowledgeDisposition({
        exactDuplicate: false,
        maxLexical: 0.2,
        maxVector: 0.2,
        entityOverlap: 0,
      }),
    ).toBe("new");
    expect(
      fallbackKnowledgeDisposition({
        exactDuplicate: false,
        maxLexical: 0.42,
        maxVector: 0.7,
        entityOverlap: 0,
      }),
    ).toBe("possible_evidence");
  });
});

describe("evidence stats", () => {
  it("deduplicates repeated material from one originating note", () => {
    const stats = evidenceStats(
      [
        {
          role: "origin",
          sourceType: "note",
          sourceId: "n1",
          originNoteId: "n1",
          createdAt: "2026-09-01T00:00:00Z",
        },
        {
          role: "support",
          sourceType: "claim",
          sourceId: "c1",
          originNoteId: "n1",
          createdAt: "2026-09-01T00:01:00Z",
        },
        {
          role: "support",
          sourceType: "note",
          sourceId: "n2",
          originNoteId: "n2",
          createdAt: "2026-09-02T00:00:00Z",
        },
        {
          role: "counterevidence",
          sourceType: "document",
          sourceId: "d1",
          originDocumentId: "d1",
          createdAt: "2026-09-03T00:00:00Z",
        },
      ],
      ["e1", "e1", "e2"],
    );
    expect(stats.supportingSources).toBe(2);
    expect(stats.counterItems).toBe(1);
    expect(stats.distinctCompanies).toBe(2);
    expect(stats.lastStrengthenedAt).toBe("2026-09-02T00:00:00Z");
    expect(stats.lastChallengedAt).toBe("2026-09-03T00:00:00Z");
  });
});

describe("lexical overlap", () => {
  it("scores shared tokens", () => {
    expect(lexicalKnowledgeOverlap("gross margin mix shift", "margin mix is the tell")).toBeGreaterThan(0.3);
  });
});

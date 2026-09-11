import { describe, expect, it } from "vitest";
import {
  companyToMarkdown,
  indexMarkdown,
  noteFilename,
  noteToMarkdown,
  themeToMarkdown,
} from "@/lib/export/markdown";

const note = {
  id: "note-1",
  captured_at: "2026-09-11T12:00:00.000Z",
  source_type: "typed",
  title: "NVTS margins",
  raw_text: "sold $NVTS at $6.10",
  interpreted_text: "Sold Navitas around 6.10",
};

describe("markdown export", () => {
  it("writes frontmatter, original text, and sections", () => {
    const md = noteToMarkdown(note, {
      entities: [{ ticker: "NVTS", name: "Navitas" }],
      themes: [{ name: "Power semis" }],
      claims: [{ claim_text: "Margins inflect in 2H", claim_type: "thesis", status: "active" }],
      questions: [{ question_text: "When?", status: "resolved", resolution_comment: "2H slip" }],
      followups: [{ text: "Re-read 10-Q", status: "open" }],
      annotations: [
        { id: "a1", text: "Check mix", parent_annotation_id: null, created_at: "2026-09-11T13:00:00Z" },
        { id: "a2", text: "SiC vs GaN", parent_annotation_id: "a1", created_at: "2026-09-11T13:05:00Z" },
      ],
      links: [{ url: "https://example.com/a", title: "Filing" }],
      prices: [{ ticker: "NVTS", price: 6.1, currency: "USD" }],
    });
    expect(md).toContain("tickers: [NVTS]");
    expect(md).toContain("sold $NVTS at $6.10");
    expect(md).toContain("## Interpreted");
    expect(md).toContain("[resolved] When? → 2H slip");
    expect(md).toContain("- Check mix");
    expect(md).toContain("  - SiC vs GaN");
    expect(md).toContain("[Filing](https://example.com/a)");
    expect(md).not.toMatch(/<[^>]+>/);
  });

  it("builds company markdown with relative note links", () => {
    const md = companyToMarkdown(
      { ticker: "NVTS", canonical_name: "Navitas Semiconductor" },
      {
        metaNote: "Still early on mix.",
        claims: [{ claim_text: "Inflect 2H", claim_type: "thesis", status: "active", created_at: "2026-09-01T00:00:00Z" }],
        questions: [{ question_text: "Mix?", status: "open" }],
        notes: [{ note, extras: { prices: [{ ticker: "NVTS", price: 4.21, currency: "USD" }] } }],
      },
    );
    expect(md.startsWith("# NVTS · Navitas Semiconductor")).toBe(true);
    expect(md).toContain("[Open note](./notes/2026-09-11-nvts-margins.md)");
    expect(md).toContain("Price at capture: NVTS $4.21");
    expect(md).not.toMatch(/<[^>]+>/);
  });

  it("builds a theme export and an index of relative files", () => {
    const theme = themeToMarkdown({ name: "AI capex" }, { metaNote: "Cycle is real.", notes: [{ note }] });
    expect(theme).toContain("# AI capex");
    expect(indexMarkdown([note])).toContain("./notes/2026-09-11-nvts-margins.md");
    expect(noteFilename(note)).toBe("2026-09-11-nvts-margins.md");
  });
});

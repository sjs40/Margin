import { describe, expect, it } from "vitest";
import { sanitizeAskCitations, splitCitedAnswer } from "@/lib/ask-citations";

describe("splitCitedAnswer", () => {
  it("splits prose and citation tokens into renderer segments", () => {
    expect(splitCitedAnswer("GaN demand is rising [[1]] vs silicon [[2]].")).toEqual([
      { type: "text", text: "GaN demand is rising " },
      { type: "cite", index: 1 },
      { type: "text", text: " vs silicon " },
      { type: "cite", index: 2 },
      { type: "text", text: "." },
    ]);
  });

  it("returns a single text segment when there are no citations", () => {
    expect(splitCitedAnswer("Nothing in memory.")).toEqual([
      { type: "text", text: "Nothing in memory." },
    ]);
  });
});

describe("sanitizeAskCitations", () => {
  it("keeps in-range tokens and drops invalid ones", () => {
    const result = sanitizeAskCitations("Claim [[1]] then junk [[0]] [[4]] [[2]].", 2);
    expect(result.answer).toBe("Claim [[1]] then junk [[2]].");
    expect(result.citedIndices).toEqual([1, 2]);
    expect(result.stripped).toEqual([0, 4]);
  });
});

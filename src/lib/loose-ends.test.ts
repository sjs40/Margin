import { describe, expect, it } from "vitest";
import { formatResolvedThreads } from "@/lib/loose-ends";
import { mapQuestion } from "@/features/research/loose-ends";

describe("formatResolvedThreads", () => {
  it("formats question to comment lines for memory prompts", () => {
    expect(
      formatResolvedThreads([
        { question: "Will NVTS inflect?", comment: "No, not this year." },
      ]),
    ).toBe("- Will NVTS inflect? → No, not this year.");
  });

  it("returns empty string when there is nothing resolved", () => {
    expect(formatResolvedThreads([])).toBe("");
  });
});

describe("loose-end origin vs resolution", () => {
  it("keeps originating note/document distinct from the resolving note", () => {
    const mapped = mapQuestion({
      id: "q1",
      question_text: "Does mix shift persist?",
      status: "open",
      note_id: "origin-note",
      document_id: null,
      resolved_by_note_id: "resolver-note",
    });
    expect(mapped.note_id).toBe("origin-note");
    expect(mapped.resolved_by_note_id).toBe("resolver-note");
    expect(mapped.note_id).not.toBe(mapped.resolved_by_note_id);
  });
});

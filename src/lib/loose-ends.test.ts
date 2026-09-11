import { describe, expect, it } from "vitest";
import { formatResolvedThreads } from "@/lib/loose-ends";

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

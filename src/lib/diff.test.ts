import { describe, expect, it } from "vitest";
import { diffLines } from "@/lib/diff";

describe("diffLines", () => {
  it("marks changed lines", () => {
    const diff = diffLines("alpha\nbeta\ngamma", "alpha\nBETA\ngamma");
    expect(diff).toEqual([
      { type: "equal", text: "alpha" },
      { type: "remove", text: "beta" },
      { type: "add", text: "BETA" },
      { type: "equal", text: "gamma" },
    ]);
  });

  it("handles added and removed tails", () => {
    expect(diffLines("one", "one\ntwo").some((line) => line.type === "add")).toBe(true);
    expect(diffLines("one\ntwo", "one").some((line) => line.type === "remove")).toBe(true);
  });
});

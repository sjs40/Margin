import { describe, expect, it } from "vitest";
import {
  CONTEXT_PACK_BUDGETS,
  buildContextPack,
  estimateTokens,
  selectContextPackItems,
  type ContextPackItem,
} from "@/lib/context-pack";

function item(overrides: Partial<ContextPackItem> = {}): ContextPackItem {
  return {
    id: "1",
    type: "insight",
    title: "Seed insight",
    content: "The current formulation.",
    whyIncluded: "Selected object",
    layer: "core",
    ...overrides,
  };
}

describe("context pack budgets", () => {
  it("keeps the deterministic core even when retrieved context would overflow", () => {
    const core = item({ id: "core", content: "Core formulation that must remain." });
    const retrieved = item({
      id: "extra",
      layer: "retrieved",
      title: "Retrieved note",
      whyIncluded: "Vector overlap",
      content: "x".repeat(80_000),
    });
    const selected = selectContextPackItems([core, retrieved], "compact", 200);
    expect(selected.included.some((entry) => entry.id === "core")).toBe(true);
    expect(selected.included.some((entry) => entry.id === "extra")).toBe(false);
    expect(selected.truncated).toBe(true);
  });

  it("respects compact/standard/deep budgets in rendered markdown", () => {
    const items = [
      item({ id: "core", content: "User view of the mechanism." }),
      item({
        id: "r1",
        layer: "retrieved",
        type: "note",
        title: "Extra",
        whyIncluded: "Entity overlap",
        content: "y".repeat(20_000),
      }),
    ];
    const compact = buildContextPack({
      title: "Test",
      seedType: "insight",
      seedId: "k1",
      size: "compact",
      userView: "I think mix shift is the tell.",
      suggestedView: "AI suggested a broader platform story.",
      items,
    });
    expect(compact.included.some((entry) => entry.layer === "core")).toBe(true);
    expect(compact.tokenEstimate).toBeLessThanOrEqual(CONTEXT_PACK_BUDGETS.compact + 50);
    expect(compact.markdown).toContain("# Context Handoff: Test");
    expect(compact.markdown).toContain("Return to Margin");
    expect(compact.markdown).toContain("User view:");
  });

  it("still renders when retrieval is empty (deterministic fallback)", () => {
    const result = buildContextPack({
      title: "Sparse",
      seedType: "note",
      seedId: "n1",
      size: "standard",
      userView: "Raw note.",
      suggestedView: "",
      items: [item({ type: "note", content: "Just the note." })],
    });
    expect(result.markdown).toContain("Just the note.");
    expect(result.tokenEstimate).toBe(estimateTokens(result.markdown));
    expect(result.tokenEstimate).toBeLessThan(CONTEXT_PACK_BUDGETS.standard);
  });
});

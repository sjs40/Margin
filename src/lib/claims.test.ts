import { describe, expect, it } from "vitest";
import {
  CLAIM_TYPE_ORDER,
  filterValidConflicts,
  groupClaimsByType,
  newerClaimStatus,
} from "@/lib/claims";
import {
  clampContradictionConfidence,
  clampPriorClaimsLimit,
  DEFAULT_USER_SETTINGS,
  settingsFromRow,
} from "@/lib/user-settings";

describe("claim grouping", () => {
  it("groups in the product order and drops empty types", () => {
    const grouped = groupClaimsByType([
      { claim_type: "risk", claim_text: "r" },
      { claim_type: "thesis", claim_text: "t" },
      { claim_type: "fact", claim_text: "f" },
    ]);
    expect(grouped.map((group) => group.type)).toEqual(["thesis", "fact", "risk"]);
    expect(CLAIM_TYPE_ORDER[0]).toBe("thesis");
  });
});

describe("conflict filtering", () => {
  it("keeps only in-set ids above the confidence floor", () => {
    const kept = filterValidConflicts(
      [
        {
          newClaimId: "n1",
          priorClaimId: "p1",
          relation: "contradicts",
          explanation: "ok",
          confidence: 0.8,
        },
        {
          newClaimId: "invented",
          priorClaimId: "p1",
          relation: "contradicts",
          explanation: "hallucinated",
          confidence: 0.99,
        },
        {
          newClaimId: "n1",
          priorClaimId: "p1",
          relation: "supports",
          explanation: "weak",
          confidence: 0.4,
        },
      ],
      ["n1"],
      ["p1"],
      0.7,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.relation).toBe("contradicts");
  });
});

describe("confirm mapping", () => {
  it("maps relation types onto prior claim status", () => {
    expect(newerClaimStatus("contradicts")).toBe("contradicted");
    expect(newerClaimStatus("supersedes")).toBe("superseded");
    expect(newerClaimStatus("supports")).toBeNull();
  });
});

describe("user settings defaults", () => {
  it("returns defaults when no row exists", () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("clamps confidence and prior-claim limits", () => {
    expect(clampContradictionConfidence(0.2)).toBe(0.5);
    expect(clampContradictionConfidence(1)).toBe(0.95);
    expect(clampPriorClaimsLimit(3)).toBe(10);
    expect(clampPriorClaimsLimit(500)).toBe(200);
  });
});

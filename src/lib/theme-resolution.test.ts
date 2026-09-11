import { describe, expect, it } from "vitest";
import {
  findSimilarTheme,
  formatThemePromptLine,
  levenshtein,
  normalizeThemeName,
  pickExistingTheme,
  themeNamesAreSimilar,
} from "@/lib/theme-resolution";

describe("theme similarity", () => {
  it("treats near-duplicate names as similar", () => {
    expect(themeNamesAreSimilar("AI capex", "AI Capex cycle")).toBe(true);
    expect(levenshtein(normalizeThemeName("AI capex"), normalizeThemeName("AI capx"))).toBeLessThanOrEqual(2);
    expect(findSimilarTheme("AI Capex cycle", [{ id: "1", name: "AI capex" }])?.id).toBe("1");
  });

  it("does not match unrelated themes", () => {
    expect(findSimilarTheme("Gross margins", [{ id: "1", name: "AI capex" }])).toBeNull();
  });

  it("includes aliases in prompt lines", () => {
    expect(formatThemePromptLine({ name: "AI capex", aliases: ["AI Capex cycle"] })).toBe(
      "AI capex (aliases: AI Capex cycle)",
    );
  });

  it("links proposed names to existing themes via aliases", () => {
    const match = pickExistingTheme("AI Capex cycle", [
      { id: "1", name: "AI capex", normalized_name: "ai capex", aliases: ["AI Capex cycle"] },
    ]);
    expect(match?.id).toBe("1");
  });
});

import { describe, expect, it } from "vitest";
import { isReturnToMarginDocument, parseReturnToMargin, acceptedReturnDecisions } from "@/lib/return-to-margin";
import { groupArchiveByMonth, neighboringDailyKeys } from "@/lib/daily-archive";
import { isValidDailyKey, parseDailyKey } from "@/lib/dates";

describe("return-to-margin import", () => {
  const sample = `# Context Handoff leftover

### New Insights
- Mix shift is the tell for CART.

### Framework Updates
Update the distribution vs. demand framework: distribution is the scarce asset.

### New Evidence
DoorDash contract supports the mix argument.

### Counterevidence / Boundary Conditions
Does not apply if ads become the profit pool.

### Changed Views
I no longer think GMV is the headline.

### New Questions
What happens if Uber undercuts on take rate?

### Follow-ups
Re-read the Q2 letter.

### Nothing Worth Saving
`;

  it("detects the standardized headings", () => {
    expect(isReturnToMarginDocument(sample)).toBe(true);
    expect(isReturnToMarginDocument("# Random note\n\nHello")).toBe(false);
  });

  it("parses reviewable items without applying them", () => {
    const parsed = parseReturnToMargin(sample);
    const insights = parsed.find((section) => section.key === "newInsights");
    expect(insights?.items[0]).toContain("Mix shift");
    expect(parsed.find((section) => section.key === "frameworkUpdates")?.items).toHaveLength(1);
    expect(parsed.find((section) => section.key === "newQuestions")?.items[0]).toContain("take rate");
    expect(
      acceptedReturnDecisions([
        { action: "create_insight" },
        { action: "ignore" },
      ]),
    ).toHaveLength(1);
  });
});

describe("daily archive navigation", () => {
  it("skips dates with no Daily Meta Note", () => {
    expect(neighboringDailyKeys(["2026-09-01", "2026-09-10"], "2026-09-10")).toEqual({
      previous: "2026-09-01",
      next: null,
    });
  });

  it("groups reverse-chronologically by month", () => {
    const groups = groupArchiveByMonth([
      {
        id: "a",
        date: "2026-08-02",
        title: "Aug",
        current_content: "a",
        updated_at: "2026-08-02T00:00:00Z",
      },
      {
        id: "b",
        date: "2026-09-10",
        title: "Sep",
        current_content: "b",
        updated_at: "2026-09-10T00:00:00Z",
      },
    ]);
    expect(groups[0]?.month).toBe("2026-09");
    expect(groups[0]?.items[0]?.date).toBe("2026-09-10");
  });

  it("validates YYYY-MM-DD daily keys", () => {
    expect(isValidDailyKey("2026-09-10")).toBe(true);
    expect(isValidDailyKey("2026-13-01")).toBe(false);
    expect(parseDailyKey("2026-09-10").toISOString()).toBe("2026-09-10T12:00:00.000Z");
  });

  it("finds neighbors even when the current date has no meta note", () => {
    expect(neighboringDailyKeys(["2026-09-01", "2026-09-10"], "2026-09-05")).toEqual({
      previous: "2026-09-01",
      next: "2026-09-10",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  formatCapturedAt,
  formatDailyKey,
  formatDateTime,
  formatLongDate,
  parseTimestamp,
} from "@/lib/dates";

const EASTERN = "America/New_York";

describe("parseTimestamp", () => {
  it("keeps Postgres microseconds from shifting the minute", () => {
    const parsed = parseTimestamp("2026-09-17T23:07:32.847291+00:00");
    expect(parsed.toISOString()).toBe("2026-09-17T23:07:32.847Z");
    expect(parsed.getUTCMinutes()).toBe(7);
  });

  it("treats offset-less timestamptz strings as UTC, not local midnight-or-now", () => {
    const parsed = parseTimestamp("2026-09-17T23:07:32.847291");
    expect(parsed.toISOString()).toBe("2026-09-17T23:07:32.847Z");
  });
});

describe("timestamp display", () => {
  it("shows the real local minute, not a timezone-rounded hour", () => {
    expect(formatCapturedAt("2026-09-17T23:07:32.847291+00:00", EASTERN)).toBe("7:07 PM");
    expect(formatDateTime("2026-09-17T23:07:32.847291+00:00", EASTERN)).toBe("Sep 17, 2026, 7:07 PM");
  });

  it("does not shift a date-only value to the previous calendar day", () => {
    expect(formatLongDate("2026-09-17")).toBe("September 17, 2026");
    expect(formatDailyKey("2026-09-17")).toBe("September 17, 2026");
  });
});

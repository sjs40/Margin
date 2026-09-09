import { describe, expect, it } from "vitest";
import { decideAiAccess } from "@/lib/ai-access";

describe("decideAiAccess", () => {
  const base = {
    hasUserKey: false,
    isAdmin: false,
    hostedEnabled: true,
    hostedConfigured: true,
    allowHosted: true,
    remaining: 5,
  };

  it("prefers a user key over hosted quota", () => {
    expect(decideAiAccess({ ...base, hasUserKey: true, remaining: 0 })).toEqual({ use: "user" });
  });

  it("gives the admin unlimited hosted access without consuming quota", () => {
    expect(decideAiAccess({ ...base, isAdmin: true, remaining: 0 })).toEqual({
      use: "hosted",
      consume: false,
    });
  });

  it("consumes hosted quota for trial users", () => {
    expect(decideAiAccess(base)).toEqual({ use: "hosted", consume: true });
  });

  it("blocks trial users when the daily limit is exhausted", () => {
    expect(decideAiAccess({ ...base, remaining: 0 })).toEqual({
      use: "none",
      reason: "quota_exhausted",
    });
  });

  it("blocks trial users when the admin turns hosted AI off", () => {
    expect(decideAiAccess({ ...base, hostedEnabled: false })).toEqual({
      use: "none",
      reason: "hosted_disabled",
    });
  });

  it("does not use hosted keys for nightly or search peek", () => {
    expect(decideAiAccess({ ...base, allowHosted: false })).toEqual({
      use: "none",
      reason: "own_key_required",
    });
  });
});

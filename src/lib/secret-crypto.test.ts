import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";

describe("secret-crypto", () => {
  afterEach(() => {
    delete process.env.AI_KEY_ENCRYPTION_SECRET;
  });

  it("round-trips a Gemini key", () => {
    process.env.AI_KEY_ENCRYPTION_SECRET = "test-secret-for-margin-keys";
    const payload = encryptSecret("AIzaSyTestKey123");
    expect(payload).not.toContain("AIzaSyTestKey123");
    expect(decryptSecret(payload)).toBe("AIzaSyTestKey123");
  });
});

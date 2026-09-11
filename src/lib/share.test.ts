import { describe, expect, it } from "vitest";
import { composeShareCapture, mergeCaptureDraft, safeNextPath } from "@/lib/share";

describe("composeShareCapture", () => {
  it("puts the url on its own line after text", () => {
    expect(composeShareCapture({ text: "Interesting margins", url: "https://example.com/a" })).toBe(
      "Interesting margins\n\nhttps://example.com/a",
    );
  });

  it("uses title when text is missing", () => {
    expect(composeShareCapture({ title: "Cart.com", url: "https://cart.com" })).toBe("Cart.com\n\nhttps://cart.com");
  });

  it("does not duplicate a url already in the text", () => {
    expect(composeShareCapture({ text: "https://example.com/a", url: "https://example.com/a" })).toBe(
      "https://example.com/a",
    );
  });
});

describe("mergeCaptureDraft", () => {
  it("appends shared text after an existing draft", () => {
    expect(mergeCaptureDraft("draft thought", "shared")).toBe("draft thought\n\nshared");
  });
});

describe("safeNextPath", () => {
  it("keeps relative share urls and rejects open redirects", () => {
    expect(safeNextPath("/share?text=hello")).toBe("/share?text=hello");
    expect(safeNextPath("https://evil.test")).toBe("/");
    expect(safeNextPath("//evil.test")).toBe("/");
  });
});

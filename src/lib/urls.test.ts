import { describe, expect, it } from "vitest";
import { extractUrls, hostnameOf, linkifyParts, normalizeExtractedUrl } from "@/lib/urls";

describe("extractUrls", () => {
  it("finds an https URL among comments", () => {
    const urls = extractUrls(
      "https://www.reuters.com/markets/us/nvda-beats some comments about NVDA margins",
    );
    expect(urls).toEqual(["https://www.reuters.com/markets/us/nvda-beats"]);
  });

  it("normalizes a bare www host", () => {
    expect(extractUrls("www.example.com/a looks interesting")).toEqual([
      "https://www.example.com/a",
    ]);
  });

  it("extracts a markdown link", () => {
    expect(extractUrls("See [the piece](https://example.com/story) — I disagree.")).toEqual([
      "https://example.com/story",
    ]);
  });

  it("keeps multiple URLs up to the cap", () => {
    const text = [
      "https://a.example/1",
      "https://b.example/2",
      "https://c.example/3",
      "https://d.example/4",
      "https://e.example/5",
      "https://f.example/6",
    ].join(" ");
    expect(extractUrls(text)).toHaveLength(5);
  });

  it("strips trailing sentence punctuation", () => {
    expect(extractUrls("Worth a look: https://example.com/x.")).toEqual(["https://example.com/x"]);
  });

  it("does not treat tickers or ordinary words as URLs", () => {
    expect(extractUrls("NVTS ON POWI — this depends on demand.")).toEqual([]);
    expect(extractUrls("Cart incremental margins.")).toEqual([]);
  });

  it("dedupes the same URL with different wrapping", () => {
    expect(
      extractUrls("[x](https://example.com/a) and also https://example.com/a"),
    ).toEqual(["https://example.com/a"]);
  });
});

describe("normalizeExtractedUrl", () => {
  it("rejects non-http schemes", () => {
    expect(normalizeExtractedUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExtractedUrl("ftp://files.example.com/a")).toBeNull();
  });
});

describe("hostnameOf", () => {
  it("drops www", () => {
    expect(hostnameOf("https://www.example.com/path")).toBe("example.com");
  });
});

describe("linkifyParts", () => {
  it("splits comments and a URL", () => {
    const parts = linkifyParts("See https://example.com/a here");
    expect(parts).toEqual([
      { type: "text", value: "See " },
      { type: "url", href: "https://example.com/a", display: "https://example.com/a" },
      { type: "text", value: " here" },
    ]);
  });
});

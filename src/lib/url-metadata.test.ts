import { describe, expect, it } from "vitest";
import {
  assertAllowedPageUrl,
  isBlockedHostname,
  isPrivateIp,
  parseHtmlMeta,
} from "@/lib/url-metadata";

describe("isPrivateIp", () => {
  it("blocks loopback, rfc1918, and link-local", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.4")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("169.254.1.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("allows public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost and local suffixes", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("foo.local")).toBe(true);
    expect(isBlockedHostname("metadata.google.internal")).toBe(true);
  });

  it("blocks private IP literals", () => {
    expect(isBlockedHostname("127.0.0.1")).toBe(true);
    expect(isBlockedHostname("10.1.2.3")).toBe(true);
  });

  it("allows public hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});

describe("assertAllowedPageUrl", () => {
  it("rejects non-http schemes and credentials", () => {
    expect(() => assertAllowedPageUrl("file:///etc/passwd")).toThrow();
    expect(() => assertAllowedPageUrl("https://user:pass@example.com/")).toThrow();
    expect(() => assertAllowedPageUrl("http://127.0.0.1/")).toThrow();
  });
});

describe("parseHtmlMeta", () => {
  it("reads og tags and resolves a relative image", () => {
    const html = `
      <html>
        <head>
          <title>Fallback</title>
          <meta property="og:title" content="Nvidia beats estimates" />
          <meta property="og:description" content="Commentary on margins." />
          <meta property="og:image" content="/hero.jpg" />
        </head>
      </html>
    `;
    expect(parseHtmlMeta(html, "https://example.com/story")).toEqual({
      title: "Nvidia beats estimates",
      description: "Commentary on margins.",
      imageUrl: "https://example.com/hero.jpg",
    });
  });

  it("falls back to the title tag", () => {
    const parsed = parseHtmlMeta(
      "<html><head><title>Just a title</title></head></html>",
      "https://example.com",
    );
    expect(parsed.title).toBe("Just a title");
  });
});

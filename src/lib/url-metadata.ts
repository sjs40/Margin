import { lookup } from "node:dns/promises";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Margin/0.1 (research-capture)";

export type UrlMetadata = {
  finalUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};

export function isPrivateIp(ip: string): boolean {
  const value = ip.trim().toLowerCase();
  if (value.includes(":")) {
    if (value === "::1" || value === "::") return true;
    if (value.startsWith("fe80:")) return true;
    if (value.startsWith("fc") || value.startsWith("fd")) return true;
    if (value.startsWith("::ffff:")) return isPrivateIp(value.slice(7));
    return false;
  }
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return true;
  if (host === "metadata.google.internal" || host === "metadata") return true;
  if (isIpv4Literal(host) && isPrivateIp(host)) return true;
  return false;
}

function isIpv4Literal(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

export function assertAllowedPageUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("unsupported scheme");
  }
  if (parsed.username || parsed.password) {
    throw new Error("url credentials are not allowed");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("blocked host");
  }
  return parsed;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(Number(num)));
}

function truncate(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = new RegExp(
    `<meta\\b[^>]*\\b(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*>`,
    "i",
  );
  const reversed = new RegExp(
    `<meta\\b[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*\\b(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(named) ?? html.match(reversed);
  const value = match?.[1];
  return value ? decodeEntities(value).trim() : null;
}

function titleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1]).trim() : null;
}

export function parseHtmlMeta(html: string, pageUrl: string): Omit<UrlMetadata, "finalUrl"> {
  const title =
    metaContent(html, "og:title") ?? metaContent(html, "twitter:title") ?? titleTag(html);
  const description =
    metaContent(html, "og:description") ??
    metaContent(html, "twitter:description") ??
    metaContent(html, "description");
  let image = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
  if (image) {
    try {
      const resolved = new URL(image, pageUrl);
      image =
        resolved.protocol === "http:" || resolved.protocol === "https:"
          ? resolved.toString()
          : null;
    } catch {
      image = null;
    }
  }
  return {
    title: truncate(title, 200),
    description: truncate(description, 400),
    imageUrl: image,
  };
}

async function assertPublicHostname(hostname: string) {
  if (isBlockedHostname(hostname)) throw new Error("blocked host");
  if (isIpv4Literal(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("blocked host");
    return;
  }
  const addresses = await lookup(hostname, { all: true });
  if (addresses.length === 0) throw new Error("host not found");
  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("blocked host");
  }
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = MAX_BODY_BYTES - size;
    if (value.byteLength >= remaining) {
      chunks.push(value.slice(0, remaining));
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchOnce(url: string, redirectsLeft: number): Promise<{ finalUrl: string; html: string }> {
  const parsed = assertAllowedPageUrl(url);
  await assertPublicHostname(parsed.hostname);
  const response = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location || redirectsLeft <= 0) throw new Error("too many redirects");
    const next = new URL(location, parsed).toString();
    return fetchOnce(next, redirectsLeft - 1);
  }
  if (!response.ok) throw new Error(`http ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/html|xml|text\/plain/i.test(contentType)) {
    throw new Error("unsupported content type");
  }
  const html = await readCapped(response);
  return { finalUrl: parsed.toString(), html };
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const { finalUrl, html } = await fetchOnce(url, MAX_REDIRECTS);
  const meta = parseHtmlMeta(html, finalUrl);
  if (meta.imageUrl) {
    try {
      assertAllowedPageUrl(meta.imageUrl);
    } catch {
      meta.imageUrl = null;
    }
  }
  return { finalUrl, ...meta };
}

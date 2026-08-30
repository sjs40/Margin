export const MAX_NOTE_URLS = 5;
const MAX_URL_LENGTH = 2000;

const MARKDOWN_LINK_RE = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
const HTTP_URL_RE = /\bhttps?:\/\/[^\s<>"'\[\]{}]+/gi;
const WWW_URL_RE = /\bwww\.[^\s<>"'\[\]{}]+/gi;
const TOKEN_RE =
  /(\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|\bhttps?:\/\/[^\s<>"'\[\]{}]+|\bwww\.[^\s<>"'\[\]{}]+)/gi;

export function trimTrailingPunctuation(value: string): string {
  let url = value.trim();
  url = url.replace(/[.,;:!?]+$/g, "");
  const opens = (url.match(/\(/g) ?? []).length;
  const closes = (url.match(/\)/g) ?? []).length;
  if (closes > opens) {
    let extra = closes - opens;
    while (extra > 0 && url.endsWith(")")) {
      url = url.slice(0, -1);
      extra -= 1;
    }
  }
  return url;
}

export function normalizeExtractedUrl(raw: string): string | null {
  let candidate = trimTrailingPunctuation(raw);
  if (!candidate || candidate.length > MAX_URL_LENGTH) return null;
  if (/^www\./i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function extractUrls(text: string, limit = MAX_NOTE_URLS): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const consider = (raw: string | undefined) => {
    if (!raw || found.length >= limit) return;
    const normalized = normalizeExtractedUrl(raw);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(normalized);
  };

  for (const match of text.matchAll(MARKDOWN_LINK_RE)) consider(match[1]);
  for (const match of text.matchAll(HTTP_URL_RE)) consider(match[0]);
  for (const match of text.matchAll(WWW_URL_RE)) consider(match[0]);

  return found;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export type LinkifyPart =
  | { type: "text"; value: string }
  | { type: "url"; href: string; display: string };

export function linkifyParts(text: string): LinkifyPart[] {
  const parts: LinkifyPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: "text", value: text.slice(last, index) });
    const display = match[0];
    const href = normalizeExtractedUrl(match[2] ?? display);
    if (href) parts.push({ type: "url", href, display });
    else parts.push({ type: "text", value: display });
    last = index + display.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts.length ? parts : [{ type: "text", value: text }];
}

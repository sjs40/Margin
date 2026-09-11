export function composeShareCapture(input: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): string {
  const title = input.title?.trim() ?? "";
  const text = input.text?.trim() ?? "";
  const url = input.url?.trim() ?? "";
  const chunks: string[] = [];
  if (text) chunks.push(text);
  else if (title) chunks.push(title);
  const body = chunks.join("\n\n");
  if (url && !body.includes(url)) return body ? `${body}\n\n${url}` : url;
  return body;
}

export function mergeCaptureDraft(draft: string, incoming: string): string {
  const existing = draft.trim();
  const next = incoming.trim();
  if (!next) return existing;
  if (!existing) return next;
  return `${existing}\n\n${next}`;
}

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/";
  return raw;
}

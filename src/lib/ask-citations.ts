export type CitedSegment =
  | { type: "text"; text: string }
  | { type: "cite"; index: number };

function citeToken() {
  return /\[\[(\d+)\]\]/g;
}

export function splitCitedAnswer(answer: string): CitedSegment[] {
  const segments: CitedSegment[] = [];
  let last = 0;
  const re = citeToken();
  for (const match of answer.matchAll(re)) {
    const index = Number(match[1]);
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: answer.slice(last, start) });
    segments.push({ type: "cite", index });
    last = start + match[0].length;
  }
  if (last < answer.length) segments.push({ type: "text", text: answer.slice(last) });
  return segments;
}

export function sanitizeAskCitations(
  answer: string,
  sourceCount: number,
): { answer: string; citedIndices: number[]; stripped: number[] } {
  const stripped: number[] = [];
  const cited = new Set<number>();
  const cleaned = answer.replace(citeToken(), (token, raw: string) => {
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 1 || index > sourceCount) {
      stripped.push(index);
      return "";
    }
    cited.add(index);
    return token;
  });
  return {
    answer: cleaned.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim(),
    citedIndices: [...cited].sort((a, b) => a - b),
    stripped,
  };
}

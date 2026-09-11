export type RankedHit = {
  id: string;
  kind: "note" | "document" | "company" | "theme" | "meta_note";
  title: string;
  snippet: string;
  date?: string;
  sourceType?: string;
  tickers?: string[];
  themes?: string[];
  entityScore: number;
  lexicalScore: number;
  vectorScore: number;
  recencyScore: number;
};

export function looksLikeTickerQuery(query: string): boolean {
  const trimmed = query.trim().replace(/^\$/, "").toUpperCase();
  return /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/.test(trimmed);
}

export function hybridScore(hit: RankedHit, query: string): number {
  const tickerQuery = looksLikeTickerQuery(query);
  const entityWeight = tickerQuery ? 0.7 : 0.3;
  const lexicalWeight = tickerQuery ? 0.15 : 0.25;
  const vectorWeight = tickerQuery ? 0.1 : 0.35;
  const recencyWeight = 0.05;
  return (
    hit.entityScore * entityWeight +
    hit.lexicalScore * lexicalWeight +
    hit.vectorScore * vectorWeight +
    hit.recencyScore * recencyWeight
  );
}

export function recencyScore(isoDate: string | undefined, now = Date.now()): number {
  if (!isoDate) return 0.3;
  const ageDays = (now - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
  if (Number.isNaN(ageDays)) return 0.3;
  if (ageDays <= 1) return 1;
  if (ageDays <= 7) return 0.85;
  if (ageDays <= 30) return 0.65;
  if (ageDays <= 90) return 0.45;
  return 0.25;
}

export function lexicalScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q || !text) return 0;
  const haystack = text.toLowerCase();
  if (haystack.includes(q)) return 1;
  const tokens = q.split(/\s+/).filter((token) => token.length > 1);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits / tokens.length;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function rankHits(hits: RankedHit[], query: string): RankedHit[] {
  return [...hits].sort((a, b) => hybridScore(b, query) - hybridScore(a, query));
}

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

export type VectorMatch = {
  sourceId: string;
  similarity: number;
  sourceType?: string;
};

export function looksLikeTickerQuery(query: string): boolean {
  return normalizedTickerQuery(query) !== null;
}

export function normalizedTickerQuery(query: string): string | null {
  const trimmed = query.trim().replace(/^\$/, "").toUpperCase();
  return /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/.test(trimmed) ? trimmed : null;
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

export function tickerEntityScore(query: string, tickers: readonly string[]): number {
  const symbol = normalizedTickerQuery(query);
  if (!symbol) return 0;
  return tickers.includes(symbol) ? 1 : 0;
}

export function groupTickersByOwner(
  rows: Array<{ ownerId: string; ticker?: string | null }>,
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const ticker = row.ticker?.trim();
    if (!ticker) continue;
    const existing = grouped.get(row.ownerId) ?? [];
    if (!existing.includes(ticker)) existing.push(ticker);
    grouped.set(row.ownerId, existing);
  }
  return grouped;
}

export function chunkIds(ids: readonly string[], size = 100): string[][] {
  if (size <= 0) return ids.length === 0 ? [] : [ids.slice()];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export function missingVectorSourceIds(
  hits: ReadonlyArray<Pick<RankedHit, "id">>,
  vectors: ReadonlyArray<VectorMatch>,
): string[] {
  const present = new Set(hits.map((hit) => hit.id));
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const vector of vectors) {
    if (present.has(vector.sourceId) || seen.has(vector.sourceId)) continue;
    seen.add(vector.sourceId);
    missing.push(vector.sourceId);
  }
  return missing;
}

export function missingVectorIdsBySourceType(
  hits: ReadonlyArray<Pick<RankedHit, "id">>,
  vectors: ReadonlyArray<VectorMatch>,
  sourceType: string,
): string[] {
  const missing = new Set(missingVectorSourceIds(hits, vectors));
  return [
    ...new Set(
      vectors
        .filter((vector) => vector.sourceType === sourceType && missing.has(vector.sourceId))
        .map((vector) => vector.sourceId),
    ),
  ];
}

export function mergeVectorHits(
  hits: RankedHit[],
  vectors: ReadonlyArray<VectorMatch>,
  fetchedHits: RankedHit[] = [],
): RankedHit[] {
  const merged = hits.map((hit) => ({ ...hit }));
  const byId = new Map(merged.map((hit) => [hit.id, hit]));

  for (const extra of fetchedHits) {
    if (byId.has(extra.id)) continue;
    const copy = { ...extra };
    merged.push(copy);
    byId.set(copy.id, copy);
  }

  for (const vector of vectors) {
    const existing = byId.get(vector.sourceId);
    if (!existing) continue;
    existing.vectorScore = Math.max(existing.vectorScore, vector.similarity);
  }

  return merged;
}

export function formatMemoryContext(hits: RankedHit[], limit = 12): string {
  return hits
    .slice(0, limit)
    .map(
      (hit, offset) =>
        `[${offset + 1}] id=${hit.id} kind=${hit.kind} date=${hit.date ?? ""} title=${hit.title}\n${hit.snippet}`,
    )
    .join("\n\n");
}

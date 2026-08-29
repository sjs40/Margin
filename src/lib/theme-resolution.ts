export function normalizeThemeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type ThemeCandidate = {
  id: string;
  name: string;
  normalized_name: string;
  similarity?: number;
};

export function pickExistingTheme(
  proposedName: string,
  existing: ThemeCandidate[],
  similarityThreshold = 0.82,
): ThemeCandidate | null {
  const normalized = normalizeThemeName(proposedName);
  const exact = existing.find((theme) => theme.normalized_name === normalized);
  if (exact) return exact;

  const scored = existing
    .map((theme) => ({
      theme,
      score: theme.similarity ?? tokenOverlap(normalized, theme.normalized_name),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score >= similarityThreshold) return best.theme;
  return null;
}

export function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

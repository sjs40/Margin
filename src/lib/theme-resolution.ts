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
  aliases?: string[];
};

function normalizedThemeLabels(theme: ThemeCandidate): string[] {
  return [
    theme.normalized_name,
    ...((theme.aliases ?? []).map((alias) => normalizeThemeName(alias)).filter(Boolean)),
  ];
}

export function pickExistingTheme(
  proposedName: string,
  existing: ThemeCandidate[],
  similarityThreshold = 0.82,
): ThemeCandidate | null {
  const normalized = normalizeThemeName(proposedName);
  const exact = existing.find((theme) => normalizedThemeLabels(theme).includes(normalized));
  if (exact) return exact;

  const scored = existing
    .map((theme) => ({
      theme,
      score: Math.max(
        theme.similarity ?? 0,
        ...normalizedThemeLabels(theme).map((label) => tokenOverlap(normalized, label)),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score >= similarityThreshold) return best.theme;
  return null;
}

export function levenshtein(a: string, b: string): number {
  const rows = a.length;
  const cols = b.length;
  const matrix = Array.from({ length: rows + 1 }, () => Array.from({ length: cols + 1 }, () => 0));
  for (let i = 0; i <= rows; i += 1) matrix[i]![0] = i;
  for (let j = 0; j <= cols; j += 1) matrix[0]![j] = j;
  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[rows]![cols]!;
}

export function themeNamesAreSimilar(a: string, b: string): boolean {
  const left = normalizeThemeName(a);
  const right = normalizeThemeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  return levenshtein(left, right) <= 2;
}

export function findSimilarTheme<T extends { name: string; aliases?: string[] }>(
  proposedName: string,
  existing: T[],
): T | null {
  return (
    existing.find((theme) => {
      if (themeNamesAreSimilar(proposedName, theme.name)) return true;
      return (theme.aliases ?? []).some((alias) => themeNamesAreSimilar(proposedName, alias));
    }) ?? null
  );
}

export function formatThemePromptLine(theme: { name: string; aliases?: string[] }): string {
  const aliases = (theme.aliases ?? []).filter(Boolean);
  return aliases.length ? `${theme.name} (aliases: ${aliases.join(", ")})` : theme.name;
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

export const CLAIM_TYPE_ORDER = [
  "thesis",
  "inference",
  "observation",
  "fact",
  "management_claim",
  "external_claim",
  "risk",
  "counterargument",
] as const;

export type ClaimTypeOrder = (typeof CLAIM_TYPE_ORDER)[number];

export type ClaimConflictInput = {
  newClaimId: string;
  priorClaimId: string;
  relation: "contradicts" | "supersedes" | "supports";
  explanation: string;
  confidence: number;
};

export function groupClaimsByType<T extends { claim_type: string }>(claims: T[]): Array<{
  type: ClaimTypeOrder;
  claims: T[];
}> {
  return CLAIM_TYPE_ORDER.map((type) => ({
    type,
    claims: claims.filter((claim) => claim.claim_type === type),
  })).filter((group) => group.claims.length > 0);
}

export function filterValidConflicts(
  conflicts: ClaimConflictInput[],
  newClaimIds: Iterable<string>,
  priorClaimIds: Iterable<string>,
  minConfidence: number,
): ClaimConflictInput[] {
  const news = new Set(newClaimIds);
  const priors = new Set(priorClaimIds);
  const seen = new Set<string>();
  const valid: ClaimConflictInput[] = [];
  for (const conflict of conflicts) {
    if (conflict.confidence < minConfidence) continue;
    if (!news.has(conflict.newClaimId) || !priors.has(conflict.priorClaimId)) continue;
    if (conflict.newClaimId === conflict.priorClaimId) continue;
    const key = `${conflict.newClaimId}:${conflict.priorClaimId}:${conflict.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(conflict);
  }
  return valid;
}

export function newerClaimStatus(
  relation: "contradicts" | "supersedes" | "supports",
): "contradicted" | "superseded" | null {
  if (relation === "contradicts") return "contradicted";
  if (relation === "supersedes") return "superseded";
  return null;
}

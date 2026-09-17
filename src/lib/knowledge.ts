import type {
  KnowledgeKind,
  KnowledgeOrigin,
  KnowledgeSourceRole,
  KnowledgeSourceType,
} from "@/types/domain";

export const KNOWLEDGE_AUTO_PROPOSE_THRESHOLD = 0.82;

export const SUPPORTING_ROLES: KnowledgeSourceRole[] = ["origin", "support", "example"];
export const CHALLENGING_ROLES: KnowledgeSourceRole[] = [
  "counterevidence",
  "counterexample",
  "boundary_condition",
];

export type KnowledgeFingerprintInput = {
  kind: KnowledgeKind;
  title: string;
  summary: string;
};

export function normalizeKnowledgeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function knowledgeFingerprint(input: KnowledgeFingerprintInput): string {
  return `${input.kind}:${normalizeKnowledgeText(input.title)}|${normalizeKnowledgeText(input.summary)}`;
}

export function isExactKnowledgeDuplicate(
  candidate: KnowledgeFingerprintInput,
  existing: KnowledgeFingerprintInput,
): boolean {
  return knowledgeFingerprint(candidate) === knowledgeFingerprint(existing);
}

export function lexicalKnowledgeOverlap(a: string, b: string): number {
  const left = new Set(normalizeKnowledgeText(a).split(" ").filter((token) => token.length > 2));
  const right = new Set(normalizeKnowledgeText(b).split(" ").filter((token) => token.length > 2));
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

export type KnowledgeDisposition = "new" | "possible_duplicate" | "possible_update" | "possible_evidence";

export function fallbackKnowledgeDisposition(input: {
  exactDuplicate: boolean;
  maxLexical: number;
  maxVector: number;
  entityOverlap: number;
}): KnowledgeDisposition {
  if (input.exactDuplicate) return "possible_duplicate";
  if (input.maxLexical >= 0.72 || input.maxVector >= 0.86) return "possible_duplicate";
  if (input.entityOverlap > 0 && (input.maxLexical >= 0.45 || input.maxVector >= 0.72)) {
    return "possible_update";
  }
  if (input.maxVector >= 0.64 || input.maxLexical >= 0.4) return "possible_evidence";
  return "new";
}

export function crossesAutoProposeThreshold(
  confidence: number,
  threshold = KNOWLEDGE_AUTO_PROPOSE_THRESHOLD,
): boolean {
  return confidence >= threshold;
}

export type EvidenceSource = {
  role: KnowledgeSourceRole;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  originNoteId?: string | null;
  originDocumentId?: string | null;
  entityIds?: string[];
  createdAt: string;
};

function independentOriginKey(source: EvidenceSource): string {
  if (source.originNoteId) return `note:${source.originNoteId}`;
  if (source.originDocumentId) return `document:${source.originDocumentId}`;
  if (source.sourceType === "note" || source.sourceType === "document") {
    return `${source.sourceType}:${source.sourceId}`;
  }
  return `${source.sourceType}:${source.sourceId}`;
}

export type EvidenceStats = {
  supportingSources: number;
  distinctCompanies: number;
  counterItems: number;
  lastStrengthenedAt: string | null;
  lastChallengedAt: string | null;
};

export function evidenceStats(sources: EvidenceSource[], linkedEntityIds: string[] = []): EvidenceStats {
  const supporting = new Set<string>();
  const challenging = new Set<string>();
  let lastStrengthenedAt: string | null = null;
  let lastChallengedAt: string | null = null;
  for (const source of sources) {
    const key = independentOriginKey(source);
    if (SUPPORTING_ROLES.includes(source.role)) {
      supporting.add(key);
      if (!lastStrengthenedAt || source.createdAt > lastStrengthenedAt) {
        lastStrengthenedAt = source.createdAt;
      }
    }
    if (CHALLENGING_ROLES.includes(source.role)) {
      challenging.add(key);
      if (!lastChallengedAt || source.createdAt > lastChallengedAt) {
        lastChallengedAt = source.createdAt;
      }
    }
  }
  return {
    supportingSources: supporting.size,
    distinctCompanies: new Set(linkedEntityIds).size,
    counterItems: challenging.size,
    lastStrengthenedAt,
    lastChallengedAt,
  };
}

export function canAutoOverwriteKnowledge(input: {
  userEdited: boolean;
  origin: KnowledgeOrigin;
  state: string;
}): boolean {
  if (input.userEdited) return false;
  if (input.state === "active" && input.origin === "user") return false;
  return true;
}

export function knowledgeHref(id: string): string {
  return `/research/knowledge/${id}`;
}

export function sourceHref(sourceType: KnowledgeSourceType, sourceId: string): string {
  switch (sourceType) {
    case "note":
      return `/notes/${sourceId}`;
    case "document":
      return `/documents/${sourceId}`;
    case "meta_note":
      return "/today";
    case "claim":
      return `/research`;
    case "knowledge_object":
      return knowledgeHref(sourceId);
    default: {
      const exhaustive: never = sourceType;
      return exhaustive;
    }
  }
}

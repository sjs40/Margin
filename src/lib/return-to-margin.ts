export const RETURN_TO_MARGIN_HEADINGS = [
  "new insights",
  "framework updates",
  "new evidence",
  "counterevidence / boundary conditions",
  "counterevidence",
  "boundary conditions",
  "changed views",
  "new questions",
  "follow-ups",
  "followups",
  "nothing worth saving",
] as const;

export type ReturnToMarginSectionKey =
  | "newInsights"
  | "frameworkUpdates"
  | "newEvidence"
  | "counterevidence"
  | "changedViews"
  | "newQuestions"
  | "followUps"
  | "nothingWorthSaving";

const RETURN_ALIASES: Record<string, ReturnToMarginSectionKey> = {
  "new insights": "newInsights",
  "framework updates": "frameworkUpdates",
  "new evidence": "newEvidence",
  "counterevidence / boundary conditions": "counterevidence",
  counterevidence: "counterevidence",
  "boundary conditions": "counterevidence",
  "changed views": "changedViews",
  "new questions": "newQuestions",
  "follow-ups": "followUps",
  followups: "followUps",
  "nothing worth saving": "nothingWorthSaving",
};

export type ReturnToMarginProposal = {
  key: ReturnToMarginSectionKey;
  heading: string;
  items: string[];
};

export function isReturnToMarginDocument(raw: string): boolean {
  const headings = raw
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,3}\s+(.+)$/)?.[1]?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  const matched = headings.filter((heading) => heading in RETURN_ALIASES);
  return matched.length >= 3;
}

export function parseReturnToMargin(raw: string): ReturnToMarginProposal[] {
  const lines = raw.split(/\r?\n/);
  const sections = new Map<ReturnToMarginSectionKey, string[]>();
  let current: ReturnToMarginSectionKey | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!current) return;
    const body = buffer.join("\n").trim();
    const items = splitProposalItems(body);
    const existing = sections.get(current) ?? [];
    sections.set(current, [...existing, ...items]);
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flush();
      const key = RETURN_ALIASES[heading[1].trim().toLowerCase()];
      current = key ?? null;
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();

  return [...sections.entries()].map(([key, items]) => ({
    key,
    heading: headingForKey(key),
    items: items.filter((item) => item.trim().length > 0),
  }));
}

export function splitProposalItems(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  const bullet = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
  if (bullet.length > 1) return bullet;
  const numbered = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;
  return [trimmed];
}

function headingForKey(key: ReturnToMarginSectionKey): string {
  switch (key) {
    case "newInsights":
      return "New Insights";
    case "frameworkUpdates":
      return "Framework Updates";
    case "newEvidence":
      return "New Evidence";
    case "counterevidence":
      return "Counterevidence / Boundary Conditions";
    case "changedViews":
      return "Changed Views";
    case "newQuestions":
      return "New Questions";
    case "followUps":
      return "Follow-ups";
    case "nothingWorthSaving":
      return "Nothing Worth Saving";
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

export function acceptedReturnDecisions<T extends { action: string }>(decisions: T[]): T[] {
  return decisions.filter((decision) => decision.action !== "ignore");
}

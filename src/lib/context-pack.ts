import type { ContextPackSize, ContextPackSeedType } from "@/types/domain";

export const CONTEXT_PACK_BUDGETS: Record<ContextPackSize, number> = {
  compact: 4000,
  standard: 12000,
  deep: 30000,
};

export const CONTEXT_PACK_PROMPT_VERSION = "context-pack-v1";

export type ContextPackLayer = "core" | "retrieved";

export type ContextPackItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  whyIncluded: string;
  layer: ContextPackLayer;
  date?: string | null;
  href?: string;
  createdBy?: "user" | "ai" | "mixed";
};

export type ContextPackInput = {
  title: string;
  seedType: ContextPackSeedType;
  seedId: string;
  size: ContextPackSize;
  objective?: string | null;
  userView: string;
  suggestedView: string;
  items: ContextPackItem[];
};

export type ContextPackResult = {
  markdown: string;
  tokenEstimate: number;
  included: ContextPackItem[];
  truncated: boolean;
};

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function remainingBudget(size: ContextPackSize, usedTokens: number): number {
  return Math.max(0, CONTEXT_PACK_BUDGETS[size] - usedTokens);
}

function clipToBudget(text: string, tokenBudget: number): string {
  if (tokenBudget <= 0) return "";
  const charBudget = tokenBudget * 4;
  if (text.length <= charBudget) return text;
  return `${text.slice(0, Math.max(0, charBudget - 1)).trim()}…`;
}

export function selectContextPackItems(
  items: ContextPackItem[],
  size: ContextPackSize,
  reservedTokens: number,
): { included: ContextPackItem[]; truncated: boolean } {
  const budget = CONTEXT_PACK_BUDGETS[size] - reservedTokens;
  const included: ContextPackItem[] = [];
  let used = 0;
  let truncated = false;
  const core = items.filter((item) => item.layer === "core");
  const retrieved = items.filter((item) => item.layer === "retrieved");
  for (const item of [...core, ...retrieved]) {
    const cost = estimateTokens(`${item.title}\n${item.content}\n${item.whyIncluded}`);
    if (used + cost > budget && included.length > 0 && item.layer === "retrieved") {
      truncated = true;
      continue;
    }
    if (used + cost > budget && item.layer === "core") {
      const leftover = Math.max(80, budget - used);
      included.push({ ...item, content: clipToBudget(item.content, leftover) });
      used = budget;
      truncated = true;
      continue;
    }
    included.push(item);
    used += cost;
  }
  return { included, truncated };
}

export function renderContextPackMarkdown(input: ContextPackInput, included: ContextPackItem[]): string {
  const core = included.filter((item) => item.layer === "core");
  const retrieved = included.filter((item) => item.layer === "retrieved");
  const supporting = included.filter((item) => /support|evidence|origin/i.test(item.whyIncluded));
  const counter = included.filter((item) => /counter|weak|boundar/i.test(item.whyIncluded));
  const related = included.filter((item) =>
    ["company", "theme", "insight", "framework"].includes(item.type),
  );
  const questions = included.filter((item) => item.type === "question" || item.type === "followup");

  const lines = [
    `# Context Handoff: ${input.title}`,
    "",
    "## Objective",
    input.objective?.trim() || "Develop the selected thinking. Do not merely summarize it.",
    "",
    "## Selected object / current view",
    core[0]?.content || input.userView || "(none)",
    "",
    "## What the user currently believes vs. what Margin/AI has merely suggested",
    `User view:\n${input.userView || "(not distinguished)"}`,
    "",
    `Margin/AI suggestions:\n${input.suggestedView || "(none labeled)"}`,
    "",
    "## Key supporting evidence",
    formatList(supporting.length ? supporting : core.slice(1, 6)),
    "",
    "## Counterevidence / weaknesses / boundary conditions",
    formatList(counter, "None recorded."),
    "",
    "## Relevant companies / themes / frameworks",
    formatList(related, "None directly linked."),
    "",
    "## Open questions",
    formatList(questions, "None recorded."),
    "",
    "## Additional retrieved context",
    retrieved.length
      ? retrieved.map((item) => `### ${item.title}\nWhy included: ${item.whyIncluded}\n\n${item.content}`).join("\n\n")
      : "None. Sparse objects should stay sparse.",
    "",
    "## Source index",
    included
      .map(
        (item, index) =>
          `${index + 1}. ${item.type} — ${item.title}${item.date ? ` (${item.date.slice(0, 10)})` : ""} [${item.layer}]`,
      )
      .join("\n"),
    "",
    "## Instructions for the external model",
    "- Develop the idea rather than merely summarizing it.",
    "- Challenge weak analogies.",
    "- Identify falsifiers and missing evidence.",
    "- Distinguish the user's prior view from new suggestions.",
    "- Explain causal mechanisms for any proposed connection.",
    "",
    "## Return to Margin",
    "Use these headings so Margin can review what is worth saving:",
    "",
    "### New Insights",
    "",
    "### Framework Updates",
    "",
    "### New Evidence",
    "",
    "### Counterevidence / Boundary Conditions",
    "",
    "### Changed Views",
    "",
    "### New Questions",
    "",
    "### Follow-ups",
    "",
    "### Nothing Worth Saving",
  ];
  return lines.join("\n");
}

function formatList(items: ContextPackItem[], empty = "None."): string {
  if (items.length === 0) return empty;
  return items.map((item) => `- ${item.title}: ${item.whyIncluded}`).join("\n");
}

export function buildContextPack(input: ContextPackInput): ContextPackResult {
  const skeleton = renderContextPackMarkdown(input, []);
  const reserved = estimateTokens(skeleton) + 80;
  const { included, truncated } = selectContextPackItems(input.items, input.size, reserved);
  const markdown = renderContextPackMarkdown(input, included);
  return {
    markdown,
    tokenEstimate: estimateTokens(markdown),
    included,
    truncated,
  };
}

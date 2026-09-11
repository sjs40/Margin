export type ResolvedThread = {
  question: string;
  comment: string | null;
};

export function formatResolvedThreads(items: ResolvedThread[]): string {
  if (items.length === 0) return "";
  return items
    .map((item) => `- ${item.question} → ${item.comment?.trim() || "(no comment)"}`)
    .join("\n");
}

import type { ProcessingStatus } from "@/types/domain";
import { cn } from "@/lib/utils";

const LABELS: Record<ProcessingStatus, string> = {
  pending: "Saved",
  processing: "Processing…",
  ready: "Ready",
  failed: "Needs review",
  needs_review: "Needs review",
};

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground",
        status === "failed" || status === "needs_review" ? "text-destructive" : null,
        status === "processing" ? "text-primary" : null,
      )}
    >
      {LABELS[status]}
    </span>
  );
}

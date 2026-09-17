"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyReturnToMarginReview, type ReviewDecision } from "@/features/import/actions";
import { diffLines } from "@/lib/diff";
import type { ReturnToMarginProposal } from "@/lib/return-to-margin";

type Action = ReviewDecision["action"];

const DEFAULT_ACTION: Record<ReturnToMarginProposal["key"], Action> = {
  newInsights: "create_insight",
  frameworkUpdates: "update_framework",
  newEvidence: "attach_support",
  counterevidence: "attach_counter",
  changedViews: "ignore",
  newQuestions: "create_question",
  followUps: "create_followup",
  nothingWorthSaving: "ignore",
};

export function ReturnReviewForm({
  documentId,
  proposals,
  frameworks,
}: {
  documentId: string;
  proposals: ReturnToMarginProposal[];
  frameworks: Array<{ id: string; title: string; summary: string; body: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, { action: Action; targetId: string }>>({});

  const rows = useMemo(
    () =>
      proposals.flatMap((section) =>
        section.items.map((text, index) => ({
          key: `${section.key}:${index}`,
          section,
          index,
          text,
        })),
      ),
    [proposals],
  );

  function choice(rowKey: string, sectionKey: ReturnToMarginProposal["key"]) {
    return choices[rowKey] ?? { action: DEFAULT_ACTION[sectionKey], targetId: frameworks[0]?.id ?? "" };
  }

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const decisions: ReviewDecision[] = rows.map((row) => {
          const selected = choice(row.key, row.section.key);
          return {
            key: row.section.key,
            index: row.index,
            action: selected.action,
            targetId: selected.targetId || undefined,
          };
        });
        const result = await applyReturnToMarginReview(documentId, decisions);
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/documents/${documentId}`);
      }}
    >
      {rows.map((row) => {
        const selected = choice(row.key, row.section.key);
        const framework = frameworks.find((item) => item.id === selected.targetId);
        const diff =
          selected.action === "update_framework" && framework
            ? diffLines(framework.body, `${framework.body}\n\nUpdate from import:\n${row.text}`)
            : null;
        return (
          <div key={row.key} className="rounded-lg border border-border p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {row.section.heading} · external-model text
            </p>
            <p className="mt-2 text-sm leading-6">{row.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
                value={selected.action}
                onChange={(event) =>
                  setChoices((current) => ({
                    ...current,
                    [row.key]: { ...selected, action: event.target.value as Action },
                  }))
                }
              >
                <option value="ignore">Ignore</option>
                <option value="create_insight">Create insight</option>
                <option value="update_framework">Update framework</option>
                <option value="attach_support">Attach supporting evidence</option>
                <option value="attach_counter">Attach counterevidence</option>
                <option value="add_boundary">Add boundary condition</option>
                <option value="create_question">Create question</option>
                <option value="create_followup">Create follow-up</option>
              </select>
              {selected.action === "update_framework" ||
              selected.action === "attach_support" ||
              selected.action === "attach_counter" ||
              selected.action === "add_boundary" ? (
                <Input
                  placeholder="Target knowledge id"
                  value={selected.targetId}
                  onChange={(event) =>
                    setChoices((current) => ({
                      ...current,
                      [row.key]: { ...selected, targetId: event.target.value },
                    }))
                  }
                />
              ) : null}
            </div>
            {diff ? (
              <pre className="mt-3 overflow-x-auto rounded-md border border-border p-3 font-mono text-[11px]">
                {diff.map((line, index) => (
                  <div key={`${row.key}-${index}`}>
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                    {line.text}
                  </div>
                ))}
              </pre>
            ) : null}
          </div>
        );
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Apply accepted changes"}
      </Button>
    </form>
  );
}

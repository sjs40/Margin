"use client";

import { useState } from "react";
import { diffLines } from "@/lib/diff";

type Version = {
  id: string;
  version_number: number;
  content: string;
  change_summary: string | null;
};

export function MetaNoteHistory({
  currentContent,
  versions,
}: {
  currentContent: string;
  versions: Version[];
}) {
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const selected = versions.find((version) => version.id === diffVersionId);
  const diff = selected ? diffLines(selected.content, currentContent) : null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          History
        </h2>
        <label className="text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(diffVersionId)}
            onChange={(event) => {
              if (!event.target.checked) setDiffVersionId(null);
              else setDiffVersionId(versions[0]?.id ?? null);
            }}
          />{" "}
          Diff
        </label>
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        {versions.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              className={`font-mono text-[11px] ${diffVersionId === version.id ? "underline" : ""}`}
              onClick={() => setDiffVersionId(version.id)}
            >
              v{version.version_number}
            </button>
            <p className="text-muted-foreground">{version.change_summary}</p>
          </li>
        ))}
      </ul>
      {diff ? (
        <pre className="mt-4 overflow-x-auto rounded-md border border-border p-3 font-mono text-[11px] leading-5">
          {diff.map((line, index) => (
            <div
              key={`${line.type}-${index}`}
              className={
                line.type === "add"
                  ? "bg-emerald-500/10"
                  : line.type === "remove"
                    ? "bg-destructive/10"
                    : undefined
              }
            >
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              {line.text}
            </div>
          ))}
        </pre>
      ) : null}
    </div>
  );
}

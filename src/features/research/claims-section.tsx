"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/dates";
import { groupClaimsByType } from "@/lib/claims";

export type CompanyClaim = {
  id: string;
  claim_text: string;
  claim_type: string;
  confidence: number | null;
  status: string;
  created_at: string;
  captured_at: string | null;
  note_id: string | null;
  newerClaimId?: string | null;
  newerNoteId?: string | null;
};

export function ClaimsSection({ claims }: { claims: CompanyClaim[] }) {
  const [showInactive, setShowInactive] = useState(false);
  const visible = claims.filter((claim) => showInactive || claim.status === "active");
  const grouped = groupClaimsByType(visible);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Claims
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
          Show superseded/contradicted
        </label>
      </div>
      {grouped.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No claims yet.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.type} className="mt-6">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {group.type.replace("_", " ")}
            </h3>
            <ul className="mt-2 space-y-3">
              {group.claims.map((claim) => {
                const inactive = claim.status !== "active";
                return (
                  <li key={claim.id} id={`claim-${claim.id}`} className="text-sm">
                    <p className={inactive ? "text-muted-foreground line-through" : undefined}>
                      {claim.claim_text}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {claim.confidence != null ? (
                        <Badge variant="outline" className="font-mono">
                          {claim.confidence.toFixed(2)}
                        </Badge>
                      ) : null}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatLongDate(claim.captured_at ?? claim.created_at)}
                      </span>
                      {claim.note_id ? (
                        <Link href={`/notes/${claim.note_id}`} className="text-[11px] underline">
                          Source note
                        </Link>
                      ) : null}
                      {inactive && claim.newerNoteId ? (
                        <Link
                          href={
                            claim.newerClaimId
                              ? `#claim-${claim.newerClaimId}`
                              : `/notes/${claim.newerNoteId}`
                          }
                          className="text-[11px] underline"
                        >
                          Newer claim
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
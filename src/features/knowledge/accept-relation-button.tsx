"use client";

import { Button } from "@/components/ui/button";
import { setKnowledgeRelationshipState } from "@/features/knowledge/actions";

export function AcceptRelationButton({ id }: { id: string }) {
  return (
    <Button
      variant="outline"
      className="mt-1 min-h-11 md:h-8 md:min-h-8"
      onClick={() => void setKnowledgeRelationshipState(id, "accepted").then(() => window.location.reload())}
    >
      Accept
    </Button>
  );
}

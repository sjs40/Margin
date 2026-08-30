"use client";

import { Button } from "@/components/ui/button";
import { resolveInboxItem } from "@/features/capture/actions";

type Item = {
  id: string;
  category: string;
  payload: Record<string, unknown>;
};

export function InboxActions({ item }: { item: Item }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {item.category === "suggested_theme" ? (
        <Button
          className="min-h-11 md:h-8 md:min-h-8"
          onClick={async () => {
            await resolveInboxItem(item.id, "accept_theme", {
              name: String(item.payload.name ?? ""),
            });
            window.location.reload();
          }}
        >
          Create theme
        </Button>
      ) : null}
      {item.category === "ambiguous_entity" ? (
        <Button
          className="min-h-11 md:h-8 md:min-h-8"
          variant="outline"
          onClick={async () => {
            await resolveInboxItem(item.id, "not_ticker");
            window.location.reload();
          }}
        >
          Not a ticker
        </Button>
      ) : null}
      <Button
        className="min-h-11 md:h-8 md:min-h-8"
        variant="ghost"
        onClick={async () => {
          await resolveInboxItem(item.id, "dismiss");
          window.location.reload();
        }}
      >
        Dismiss
      </Button>
    </div>
  );
}

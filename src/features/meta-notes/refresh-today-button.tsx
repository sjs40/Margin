"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { refreshToday } from "@/features/capture/actions";

export function RefreshTodayButton({ date }: { date?: string }) {
  const [pending, setPending] = useState(false);
  const historical = Boolean(date);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await refreshToday(date);
        setPending(false);
        window.location.reload();
      }}
    >
      {pending
        ? "Generating…"
        : historical
          ? "Regenerate this day"
          : "Generate / Refresh Today"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { refreshToday } from "@/features/capture/actions";

export function RefreshTodayButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await refreshToday();
        setPending(false);
        window.location.reload();
      }}
    >
      {pending ? "Generating…" : "Generate / Refresh Today"}
    </Button>
  );
}

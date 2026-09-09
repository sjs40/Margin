"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setHostedAiEnabled } from "@/features/admin/actions";

export function AdminControls({
  hostedEnabled,
  usage,
}: {
  hostedEnabled: boolean;
  usage: Array<{ email: string | null; action_count: number }>;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(hostedEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onToggle(next: boolean) {
    setPending(true);
    setError(null);
    const result = await setHostedAiEnabled(next);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEnabled(next);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="hosted-ai">5 hosted AI actions per day</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              When on, friends without a key can use your Gemini key for five actions per day. When
              off, everyone must add their own key.
            </p>
          </div>
          <Switch
            id="hosted-ai"
            checked={enabled}
            disabled={pending}
            onCheckedChange={(checked) => void onToggle(checked)}
          />
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </section>

      <section>
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Today&apos;s hosted usage
        </h2>
        {usage.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No hosted trial usage yet today.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {usage.map((row) => (
              <li key={row.email ?? "unknown"} className="flex justify-between py-2">
                <span>{row.email ?? "Unknown"}</span>
                <span className="font-mono">{row.action_count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

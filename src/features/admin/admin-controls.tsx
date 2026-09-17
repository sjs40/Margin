"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setHostedAiEnabled, triggerSecTickerSync, dryRunKnowledgeBackfill, startKnowledgeBackfill } from "@/features/admin/actions";

export function AdminControls({
  hostedEnabled,
  usage,
  tickerSync,
  settingsDistribution,
  defaultUsers,
}: {
  hostedEnabled: boolean;
  usage: Array<{ email: string | null; action_count: number }>;
  tickerSync: { lastSyncedAt: string | null; secCount: number };
  settingsDistribution: Array<{
    enabled: boolean;
    minConfidence: number;
    priorLimit: number;
    users: number;
  }>;
  defaultUsers: number;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(hostedEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

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

  async function onSync() {
    setSyncing(true);
    setSyncMessage(null);
    const result = await triggerSecTickerSync();
    setSyncing(false);
    if ("error" in result && result.error) {
      setSyncMessage(result.error);
      return;
    }
    if ("ok" in result && result.ok) {
      setSyncMessage(`Synced ${result.upserted} companies.`);
      router.refresh();
    }
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

      <section className="rounded-lg border border-border p-5">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          SEC ticker universe
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tickerSync.secCount} SEC companies
          {tickerSync.lastSyncedAt
            ? ` · last synced ${new Date(tickerSync.lastSyncedAt).toLocaleString()}`
            : " · not synced yet"}
          . Nightly cron refreshes at most once a week.
        </p>
        <Button
          className="mt-4 min-h-11"
          onClick={() => void onSync()}
          disabled={syncing}
        >
          {syncing ? "Syncing…" : "Sync SEC tickers now"}
        </Button>
        {syncMessage ? <p className="mt-3 text-sm text-muted-foreground">{syncMessage}</p> : null}
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Knowledge backfill
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Conservative extraction over existing notes/documents. Dry-run first. Does not run on deploy.
          Uses your AI policy (hosted trial counts as actions).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              const result = await dryRunKnowledgeBackfill();
              if ("error" in result && result.error) setBackfillMessage(result.error);
              else if ("ok" in result)
                setBackfillMessage(
                  `Dry run: ${result.remainingNotes} notes and ${result.remainingDocuments} documents remaining.`,
                );
            }}
          >
            Dry-run count
          </Button>
          <Button
            className="min-h-11"
            onClick={async () => {
              const result = await startKnowledgeBackfill();
              if ("error" in result && result.error) setBackfillMessage(result.error);
              else if ("ok" in result)
                setBackfillMessage(
                  `Batch: processed ${result.processed}, proposed ${result.proposed}, skipped ${result.skipped}. ${result.done ? "Complete." : "Run again for the next batch."}`,
                );
            }}
          >
            Run one batch
          </Button>
        </div>
        {backfillMessage ? <p className="mt-3 text-sm text-muted-foreground">{backfillMessage}</p> : null}
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

      <section>
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Contradiction settings
        </h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="py-2">Enabled</th>
              <th>Min confidence</th>
              <th>Prior claims</th>
              <th>Users</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2">default</td>
              <td>0.7</td>
              <td>50</td>
              <td className="font-mono">{defaultUsers}</td>
            </tr>
            {settingsDistribution.map((row) => (
              <tr
                key={`${row.enabled}-${row.minConfidence}-${row.priorLimit}`}
                className="border-b border-border"
              >
                <td className="py-2">{row.enabled ? "on" : "off"}</td>
                <td className="font-mono">{row.minConfidence}</td>
                <td className="font-mono">{row.priorLimit}</td>
                <td className="font-mono">{row.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
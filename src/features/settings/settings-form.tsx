"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeGeminiKey, saveGeminiKey, savePipelineSettings } from "@/features/settings/actions";
import type { AiStatus } from "@/lib/ai-credentials";
import type { UserSettings } from "@/lib/user-settings";
import { Switch } from "@/components/ui/switch";

export function SettingsForm({
  status,
  pipelineSettings,
  defaults,
}: {
  status: AiStatus;
  pipelineSettings: UserSettings;
  defaults: UserSettings;
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [enabled, setEnabled] = useState(pipelineSettings.contradictionDetectionEnabled);
  const [confidence, setConfidence] = useState(pipelineSettings.contradictionMinConfidence);
  const [priorLimit, setPriorLimit] = useState(pipelineSettings.contradictionPriorClaimsLimit);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveGeminiKey(key);
    setPending(false);
    if (result.error) setError(result.error);
    else {
      setKey("");
      setMessage("Gemini key saved. It is stored encrypted and will not be shown again.");
      router.refresh();
    }
  }

  async function onRemove() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await removeGeminiKey();
    setPending(false);
    if (result.error) setError(result.error);
    else {
      setMessage("Gemini key removed.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border p-5">
        <h2 className="font-medium">Gemini API key</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a key in{" "}
          <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          . Margin uses it only on the server to process your notes.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {status.hasUserKey ? "A key is saved for this account." : "No personal key is saved yet."}
        </p>
        <form onSubmit={onSave} className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="gemini-key">Gemini API key</Label>
            <Input
              id="gemini-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="AIza..."
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !key.trim()}>
              Save key
            </Button>
            {status.hasUserKey ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => void onRemove()}>
                Remove key
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      {!status.hasUserKey && !status.isAdmin ? (
        <section className="rounded-lg border border-border p-5 text-sm text-muted-foreground">
          {status.hostedEnabled && status.hostedConfigured ? (
            <p>
              Hosted AI is on. You have {status.remaining} of {status.limit} free actions left today. Add
              your own key for unlimited processing.
            </p>
          ) : (
            <p>Hosted AI is off. Add your own Gemini key to process notes with AI.</p>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-border p-5">
        <h2 className="font-medium">Advanced</h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="contradiction-enabled">Contradiction detection</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare new claims against prior views on the same company.
            </p>
          </div>
          <Switch
            id="contradiction-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        <div className="mt-5 space-y-2">
          <Label htmlFor="contradiction-confidence">
            How sure the AI must be before flagging a contradiction. Higher means fewer, cleaner
            flags.
          </Label>
          <input
            id="contradiction-confidence"
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
            className="w-full"
          />
          <p className="font-mono text-sm">{confidence.toFixed(2)}</p>
        </div>
        <div className="mt-5 space-y-2">
          <Label htmlFor="prior-claims">
            How far back to compare. Higher costs more tokens per note.
          </Label>
          <Input
            id="prior-claims"
            type="number"
            min={10}
            max={200}
            value={priorLimit}
            placeholder={String(defaults.contradictionPriorClaimsLimit)}
            onChange={(event) => setPriorLimit(Number(event.target.value))}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              setMessage(null);
              const result = await savePipelineSettings({
                contradictionDetectionEnabled: enabled,
                contradictionMinConfidence: confidence,
                contradictionPriorClaimsLimit: priorLimit,
              });
              setPending(false);
              if (result.error) setError(result.error);
              else {
                setMessage("Pipeline settings saved.");
                router.refresh();
              }
            }}
          >
            Save advanced settings
          </Button>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setEnabled(defaults.contradictionDetectionEnabled);
              setConfidence(defaults.contradictionMinConfidence);
              setPriorLimit(defaults.contradictionPriorClaimsLimit);
            }}
          >
            Reset to defaults
          </button>
        </div>
      </section>
    </div>
  );
}

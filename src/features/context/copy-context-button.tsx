"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateContextPackAction } from "@/features/context/actions";
import type { ContextPackSeedType, ContextPackSize } from "@/types/domain";

export function CopyContextButton({
  seedType,
  seedId,
}: {
  seedType: ContextPackSeedType;
  seedId: string;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<ContextPackSize>("standard");
  const [objective, setObjective] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateContextPackAction>> | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const pack = await generateContextPackAction({ seedType, seedId, size, objective });
      setResult(pack);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build context.");
    }
    setPending(false);
  }

  const core = result?.included.filter((item) => item.layer === "core") ?? [];
  const retrieved = result?.included.filter((item) => item.layer === "retrieved") ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11 md:h-8 md:min-h-8">
          Copy Context
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy context pack</DialogTitle>
          <DialogDescription>
            Deterministic core first. Retrieval is optional and may be empty.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["compact", "standard", "deep"] as const).map((value) => (
              <Button
                key={value}
                variant={size === value ? "default" : "outline"}
                className="min-h-11 md:h-8 md:min-h-8"
                onClick={() => setSize(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <Textarea
            placeholder="Optional objective"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            rows={3}
          />
          <Button disabled={pending} onClick={() => void generate()}>
            {pending ? "Building…" : "Build pack"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {result ? (
            <div className="space-y-3 text-sm">
              <p className="font-mono text-[11px] text-muted-foreground">
                ~{result.tokenEstimate} tokens{result.truncated ? " · truncated" : ""}
              </p>
              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Deterministic core
                </p>
                <ul className="mt-2 list-disc pl-5">
                  {core.map((item) => (
                    <li key={`${item.layer}-${item.id}`}>{item.title}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Retrieved additions
                </p>
                {retrieved.length === 0 ? (
                  <p className="mt-2 text-muted-foreground">None.</p>
                ) : (
                  <ul className="mt-2 list-disc pl-5">
                    {retrieved.map((item) => (
                      <li key={`${item.layer}-${item.id}`}>{item.title}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void navigator.clipboard.writeText(result.markdown)}
                >
                  Copy Markdown
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([result.markdown], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "context-pack.md";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download .md
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

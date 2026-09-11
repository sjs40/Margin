"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { mergeThemes } from "@/features/research/actions";

export function MergeThemeControl({
  themeId,
  themes,
}: {
  themeId: string;
  themes: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [targetId, setTargetId] = useState(themes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  if (themes.length === 0) return null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="min-h-11 md:h-8 md:min-h-8">
          Merge into…
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Merge this theme</AlertDialogTitle>
          <AlertDialogDescription>
            Notes, claims, and questions move to the theme you pick. This theme is archived and its
            URL will redirect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <select
          className="min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            disabled={pending || !targetId}
            onClick={async () => {
              setPending(true);
              setError(null);
              const result = await mergeThemes(themeId, targetId);
              setPending(false);
              if (result && "error" in result && result.error) {
                setError(result.error);
                return;
              }
              if (result && "targetId" in result && result.targetId) {
                setOpen(false);
                router.push(`/research/themes/${result.targetId}`);
              }
            }}
          >
            {pending ? "Merging…" : "Merge"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

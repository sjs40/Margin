import Link from "next/link";
import type { AiStatus } from "@/lib/ai-credentials";

export function AiStatusBanner({ status }: { status: AiStatus }) {
  if (status.hasUserKey || status.isAdmin) return null;
  if (status.hostedEnabled && status.hostedConfigured && status.remaining > 0) {
    return (
      <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
        {status.remaining} hosted AI {status.remaining === 1 ? "action" : "actions"} left today.{" "}
        <Link href="/settings" className="underline">
          Add your own Gemini key
        </Link>{" "}
        for unlimited processing.
      </p>
    );
  }
  return (
    <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
      Notes still save. AI processing needs a Gemini key.{" "}
      <Link href="/settings" className="underline">
        Add one in Settings
      </Link>
      .
    </p>
  );
}

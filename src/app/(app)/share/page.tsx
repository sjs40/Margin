import { CaptureBox } from "@/features/capture/capture-box";
import { composeShareCapture } from "@/lib/share";

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
}) {
  const params = await searchParams;
  const initialValue = composeShareCapture(params);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">Capture</h1>
      <p className="mt-2 text-sm text-muted-foreground">Shared from another app. Save as a normal note.</p>
      <div className="mt-6">
        <CaptureBox initialValue={initialValue} />
      </div>
    </div>
  );
}

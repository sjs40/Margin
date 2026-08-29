import { CameraCapture } from "@/features/capture/camera-capture";

export default function CameraPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl">Camera</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Photograph a handwritten page. The original image is kept as source evidence.
      </p>
      <div className="mt-6">
        <CameraCapture />
      </div>
    </div>
  );
}

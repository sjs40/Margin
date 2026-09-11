import JSZip from "jszip";
import { noteExportFiles, type ExportNote, type NoteExportExtras } from "@/lib/export/markdown";

export async function allNotesToMarkdown(
  notes: Array<{ note: ExportNote; extras?: NoteExportExtras }>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  const files = noteExportFiles(notes);
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "uint8array" });
}

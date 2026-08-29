import { ImportForm } from "@/features/documents/import-form";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">Import</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a MetaNote or any Markdown from ChatGPT, Claude, Gemini, or your own files.
        Frontmatter is optional.
      </p>
      <div className="mt-6">
        <ImportForm />
      </div>
    </div>
  );
}

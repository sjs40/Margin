import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";
import { ProcessingBadge } from "@/components/processing-badge";
import { CopyContextButton } from "@/features/context/copy-context-button";
import { DevelopAction } from "@/features/context/develop-action";
import { isReturnToMarginDocument } from "@/lib/return-to-margin";
import type { ProcessingStatus } from "@/types/domain";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase.from("documents").select("*").eq("id", id).single();
  if (!document) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {document.document_type.replace("_", " ")} · {document.source || "import"}
      </p>
      <h1 className="mt-2 font-serif text-3xl">{document.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ProcessingBadge status={document.processing_status as ProcessingStatus} />
        <CopyContextButton seedType="document" seedId={document.id} />
        <DevelopAction />
        {isReturnToMarginDocument(document.raw_content) ? (
          <Link href={`/import/review/${document.id}`} className="text-sm underline">
            Review Return to Margin
          </Link>
        ) : null}
      </div>
      <article className="mt-8">
        <Markdown content={document.interpreted_content || document.raw_content} />
      </article>
    </div>
  );
}

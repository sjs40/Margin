import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReturnReviewForm } from "@/features/import/return-review-form";
import { isReturnToMarginDocument, parseReturnToMargin } from "@/lib/return-to-margin";

export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase.from("documents").select("*").eq("id", id).single();
  if (!document) notFound();
  if (!isReturnToMarginDocument(document.raw_content)) notFound();
  const proposals = parseReturnToMargin(document.raw_content);
  const { data: frameworks } = await supabase
    .from("knowledge_objects")
    .select("id, title, summary, body")
    .eq("kind", "framework")
    .in("state", ["active", "proposed"])
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Return to Margin review
      </p>
      <h1 className="mt-2 font-serif text-3xl">{document.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The imported document stays a document. Accepted changes become knowledge, evidence, or Loose Ends.
        Rejected items remain in the source only.{" "}
        <Link href={`/documents/${document.id}`} className="underline">
          View document
        </Link>
      </p>
      <ReturnReviewForm documentId={document.id} proposals={proposals} frameworks={frameworks ?? []} />
    </div>
  );
}

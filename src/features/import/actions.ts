"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistExtractedKnowledge, addKnowledgeSource, appendKnowledgeVersion } from "@/ai/pipeline/knowledge";
import { parseReturnToMargin, type ReturnToMarginSectionKey, acceptedReturnDecisions } from "@/lib/return-to-margin";

export type ReviewDecision = {
  key: ReturnToMarginSectionKey;
  index: number;
  action:
    | "create_insight"
    | "update_framework"
    | "attach_support"
    | "attach_counter"
    | "add_boundary"
    | "create_question"
    | "create_followup"
    | "ignore";
  targetId?: string;
};

export async function applyReturnToMarginReview(documentId: string, decisions: ReviewDecision[]) {
  const { supabase, user } = await requireUser();
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();
  if (!document) return { error: "Document not found." };
  const proposals = parseReturnToMargin(document.raw_content);
  const admin = createAdminClient();
  let applied = 0;
  for (const decision of acceptedReturnDecisions(decisions)) {
    const section = proposals.find((item) => item.key === decision.key);
    const text = section?.items[decision.index]?.trim();
    if (!text) continue;
    if (decision.action === "create_insight") {
      await persistExtractedKnowledge({
        userId: user.id,
        documentId,
        origin: "import",
        entityIds: [],
        themeIds: [],
        claimIds: [],
        candidateInsights: [
          {
            title: text.slice(0, 80),
            summary: text,
            rationale: text,
            relatedTickers: [],
            relatedThemes: [],
            confidence: 1,
          },
        ],
        candidateFrameworks: [],
        active: true,
        idempotent: false,
      });
      applied += 1;
      continue;
    }
    if (decision.action === "update_framework" && decision.targetId) {
      const { data: existing } = await supabase
        .from("knowledge_objects")
        .select("*")
        .eq("id", decision.targetId)
        .eq("user_id", user.id)
        .eq("kind", "framework")
        .single();
      if (!existing) continue;
      const nextBody = `${existing.body}\n\nUpdate from import:\n${text}`;
      await supabase
        .from("knowledge_objects")
        .update({
          body: nextBody,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      await appendKnowledgeVersion(admin, {
        userId: user.id,
        objectId: existing.id,
        title: existing.title,
        summary: existing.summary,
        body: nextBody,
        changeSummary: "Accepted import update",
        origin: "import",
      });
      await addKnowledgeSource(admin, {
        userId: user.id,
        objectId: existing.id,
        sourceType: "document",
        sourceId: documentId,
        role: "support",
        excerpt: text,
        createdBy: "user",
      });
      applied += 1;
      continue;
    }
    if ((decision.action === "attach_support" || decision.action === "attach_counter" || decision.action === "add_boundary") && decision.targetId) {
      await addKnowledgeSource(admin, {
        userId: user.id,
        objectId: decision.targetId,
        sourceType: "document",
        sourceId: documentId,
        role:
          decision.action === "attach_counter"
            ? "counterevidence"
            : decision.action === "add_boundary"
              ? "boundary_condition"
              : "support",
        excerpt: text,
        createdBy: "user",
      });
      applied += 1;
      continue;
    }
    if (decision.action === "create_question") {
      await supabase.from("questions").insert({
        user_id: user.id,
        document_id: documentId,
        question_text: text,
        status: "open",
        source: "user",
      });
      applied += 1;
      continue;
    }
    if (decision.action === "create_followup") {
      await supabase.from("followups").insert({
        user_id: user.id,
        document_id: documentId,
        text,
        status: "open",
        source: "user",
      });
      applied += 1;
    }
  }
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/research/knowledge");
  revalidatePath("/research/loose-ends");
  return { ok: true, applied };
}

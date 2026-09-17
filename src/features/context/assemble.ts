import { createAdminClient } from "@/lib/supabase/admin";
import { hybridSearch } from "@/ai/pipeline/search";
import {
  buildContextPack,
  type ContextPackItem,
  type ContextPackInput,
} from "@/lib/context-pack";
import type { ContextPackSeedType, ContextPackSize } from "@/types/domain";

type Admin = ReturnType<typeof createAdminClient>;

export async function assembleContextPack(input: {
  userId: string;
  seedType: ContextPackSeedType;
  seedId: string;
  size: ContextPackSize;
  objective?: string | null;
}) {
  const supabase = createAdminClient();
  const core: ContextPackItem[] = [];
  let title = "Selected thinking";
  let userView = "";
  let suggestedView = "";

  async function pushObject(objectId: string, why: string, layer: ContextPackItem["layer"] = "core") {
    const { data } = await supabase
      .from("knowledge_objects")
      .select("*")
      .eq("id", objectId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!data) return;
    core.push({
      id: data.id,
      type: data.kind,
      title: data.title,
      content: `${data.summary}\n\n${data.body}`,
      whyIncluded: why,
      layer,
      date: data.updated_at,
      createdBy: data.user_edited ? "user" : data.origin === "user" ? "user" : "ai",
    });
  }

  switch (input.seedType) {
    case "insight":
    case "framework": {
      const { data } = await supabase
        .from("knowledge_objects")
        .select("*")
        .eq("id", input.seedId)
        .eq("user_id", input.userId)
        .single();
      if (!data) throw new Error("Knowledge object not found.");
      title = data.title;
      userView = data.user_edited || data.origin === "user" ? `${data.summary}\n\n${data.body}` : "";
      suggestedView = data.origin === "ai" && !data.user_edited ? `${data.summary}\n\n${data.body}` : "";
      core.push({
        id: data.id,
        type: data.kind,
        title: data.title,
        content: `${data.summary}\n\n${data.body}`,
        whyIncluded: "Selected object",
        layer: "core",
        date: data.updated_at,
        createdBy: data.user_edited ? "user" : "ai",
      });
      const [{ data: sources }, { data: entities }, { data: themes }, { data: relations }] = await Promise.all([
        supabase.from("knowledge_object_sources").select("*").eq("knowledge_object_id", data.id),
        supabase
          .from("knowledge_object_entities")
          .select("entities(id, ticker, canonical_name)")
          .eq("knowledge_object_id", data.id),
        supabase.from("knowledge_object_themes").select("themes(id, name)").eq("knowledge_object_id", data.id),
        supabase
          .from("knowledge_relationships")
          .select("*")
          .or(`from_object_id.eq.${data.id},to_object_id.eq.${data.id}`)
          .eq("state", "accepted"),
      ]);
      for (const source of sources ?? []) {
        core.push({
          id: `${source.source_type}:${source.source_id}`,
          type: source.source_type,
          title: `${source.role} ${source.source_type}`,
          content: source.excerpt || source.rationale || source.source_id,
          whyIncluded: source.role,
          layer: "core",
          createdBy: source.created_by,
        });
      }
      for (const row of entities ?? []) {
        const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
        if (!entity) continue;
        const { data: meta } = await supabase
          .from("meta_notes")
          .select("id, title, current_content, updated_at")
          .eq("entity_id", entity.id)
          .eq("meta_type", "company")
          .maybeSingle();
        core.push({
          id: entity.id,
          type: "company",
          title: entity.ticker || entity.canonical_name,
          content: meta?.current_content || entity.canonical_name,
          whyIncluded: "Directly linked company",
          layer: "core",
        });
      }
      for (const row of themes ?? []) {
        const theme = Array.isArray(row.themes) ? row.themes[0] : row.themes;
        if (!theme) continue;
        core.push({
          id: theme.id,
          type: "theme",
          title: theme.name,
          content: theme.name,
          whyIncluded: "Directly linked theme",
          layer: "core",
        });
      }
      for (const relation of relations ?? []) {
        const otherId = relation.from_object_id === data.id ? relation.to_object_id : relation.from_object_id;
        await pushObject(otherId, relation.explanation || relation.relation_type);
      }
      break;
    }
    case "note": {
      const { data } = await supabase.from("notes").select("*").eq("id", input.seedId).eq("user_id", input.userId).single();
      if (!data) throw new Error("Note not found.");
      title = data.title || "Note";
      userView = data.raw_text || data.interpreted_text || "";
      core.push({
        id: data.id,
        type: "note",
        title: title,
        content: data.interpreted_text || data.raw_text || "",
        whyIncluded: "Selected note",
        layer: "core",
        date: data.captured_at,
        createdBy: "user",
      });
      await addLinkedGraph(supabase, input.userId, { noteId: data.id }, core);
      break;
    }
    case "document": {
      const { data } = await supabase.from("documents").select("*").eq("id", input.seedId).eq("user_id", input.userId).single();
      if (!data) throw new Error("Document not found.");
      title = data.title || "Document";
      suggestedView = data.interpreted_content || "";
      userView = "";
      core.push({
        id: data.id,
        type: "document",
        title,
        content: (data.interpreted_content || data.raw_content).slice(0, 8000),
        whyIncluded: "Selected document",
        layer: "core",
        date: data.captured_at,
        createdBy: "ai",
      });
      await addLinkedGraph(supabase, input.userId, { documentId: data.id }, core);
      break;
    }
    case "meta_note": {
      const { data } = await supabase.from("meta_notes").select("*").eq("id", input.seedId).eq("user_id", input.userId).single();
      if (!data) throw new Error("Meta note not found.");
      title = data.title;
      userView = data.user_edited ? data.current_content : "";
      suggestedView = data.user_edited ? "" : data.current_content;
      core.push({
        id: data.id,
        type: "meta_note",
        title: data.title,
        content: data.current_content,
        whyIncluded: "Selected meta note",
        layer: "core",
        date: data.updated_at,
        createdBy: data.user_edited ? "user" : "ai",
      });
      break;
    }
    case "company": {
      const { data: entity } = await supabase.from("entities").select("*").eq("id", input.seedId).single();
      if (!entity) throw new Error("Company not found.");
      title = entity.ticker || entity.canonical_name;
      const { data: meta } = await supabase
        .from("meta_notes")
        .select("*")
        .eq("entity_id", entity.id)
        .eq("user_id", input.userId)
        .eq("meta_type", "company")
        .maybeSingle();
      userView = meta?.user_edited ? meta.current_content : "";
      suggestedView = meta && !meta.user_edited ? meta.current_content : "";
      core.push({
        id: entity.id,
        type: "company",
        title,
        content: meta?.current_content || entity.canonical_name,
        whyIncluded: "Selected company",
        layer: "core",
      });
      const { data: claims } = await supabase
        .from("claims")
        .select("id, claim_text, status")
        .eq("user_id", input.userId)
        .eq("entity_id", entity.id)
        .eq("status", "active")
        .limit(12);
      for (const claim of claims ?? []) {
        core.push({
          id: claim.id,
          type: "claim",
          title: "Active claim",
          content: claim.claim_text,
          whyIncluded: "Directly linked active claim",
          layer: "core",
        });
      }
      break;
    }
    case "theme": {
      const { data: theme } = await supabase
        .from("themes")
        .select("*")
        .eq("id", input.seedId)
        .eq("user_id", input.userId)
        .single();
      if (!theme) throw new Error("Theme not found.");
      title = theme.name;
      const { data: meta } = await supabase
        .from("meta_notes")
        .select("*")
        .eq("theme_id", theme.id)
        .eq("meta_type", "theme")
        .maybeSingle();
      core.push({
        id: theme.id,
        type: "theme",
        title: theme.name,
        content: meta?.current_content || theme.description || theme.name,
        whyIncluded: "Selected theme",
        layer: "core",
      });
      break;
    }
    case "question":
    case "followup": {
      const table = input.seedType === "question" ? "questions" : "followups";
      const { data } = await supabase.from(table).select("*").eq("id", input.seedId).eq("user_id", input.userId).single();
      if (!data) throw new Error("Loose end not found.");
      const text = "question_text" in data ? data.question_text : data.text;
      title = String(text).slice(0, 80);
      userView = String(text);
      core.push({
        id: data.id,
        type: input.seedType,
        title,
        content: String(text),
        whyIncluded: "Selected open question / follow-up",
        layer: "core",
      });
      if (data.note_id) {
        const { data: note } = await supabase.from("notes").select("id, title, interpreted_text, raw_text, captured_at").eq("id", data.note_id).maybeSingle();
        if (note) {
          core.push({
            id: note.id,
            type: "note",
            title: note.title || "Originating note",
            content: note.interpreted_text || note.raw_text || "",
            whyIncluded: "Originating note",
            layer: "core",
            date: note.captured_at,
          });
        }
      }
      break;
    }
    default: {
      const exhaustive: never = input.seedType;
      return exhaustive;
    }
  }

  const retrieved: ContextPackItem[] = [];
  try {
    const hits = await hybridSearch(input.userId, `${title} ${userView || suggestedView}`.slice(0, 500));
    const seen = new Set(core.map((item) => item.id));
    for (const hit of hits.slice(0, 8)) {
      if (seen.has(hit.id)) continue;
      retrieved.push({
        id: hit.id,
        type: hit.kind,
        title: hit.title,
        content: hit.snippet,
        whyIncluded: "Retrieved: hybrid search / entity overlap",
        layer: "retrieved",
        date: hit.date,
      });
      seen.add(hit.id);
    }
  } catch {
    // Retrieval is optional; deterministic core still works.
  }

  const packInput: ContextPackInput = {
    title,
    seedType: input.seedType,
    seedId: input.seedId,
    size: input.size,
    objective: input.objective,
    userView,
    suggestedView,
    items: [...core, ...retrieved],
  };
  return buildContextPack(packInput);
}

async function addLinkedGraph(
  supabase: Admin,
  userId: string,
  input: { noteId?: string; documentId?: string },
  core: ContextPackItem[],
) {
  if (input.noteId) {
    const { data: claims } = await supabase.from("claims").select("id, claim_text").eq("note_id", input.noteId).limit(12);
    for (const claim of claims ?? []) {
      core.push({
        id: claim.id,
        type: "claim",
        title: "Claim",
        content: claim.claim_text,
        whyIncluded: "Directly linked claim",
        layer: "core",
      });
    }
    const { data: questions } = await supabase
      .from("questions")
      .select("id, question_text")
      .eq("note_id", input.noteId)
      .eq("status", "open");
    for (const question of questions ?? []) {
      core.push({
        id: question.id,
        type: "question",
        title: "Open question",
        content: question.question_text,
        whyIncluded: "Explicitly linked question",
        layer: "core",
      });
    }
    const { data: knowledge } = await supabase
      .from("knowledge_object_sources")
      .select("knowledge_object_id")
      .eq("user_id", userId)
      .eq("source_type", "note")
      .eq("source_id", input.noteId);
    const ids = [...new Set((knowledge ?? []).map((row) => row.knowledge_object_id))];
    if (ids.length) {
      const { data: objects } = await supabase.from("knowledge_objects").select("*").in("id", ids);
      for (const object of objects ?? []) {
        core.push({
          id: object.id,
          type: object.kind,
          title: object.title,
          content: `${object.summary}\n\n${object.body}`,
          whyIncluded: "Knowledge object sourced from this note",
          layer: "core",
        });
      }
    }
  }
  if (input.documentId) {
    const { data: claims } = await supabase.from("claims").select("id, claim_text").eq("document_id", input.documentId).limit(12);
    for (const claim of claims ?? []) {
      core.push({
        id: claim.id,
        type: "claim",
        title: "Claim",
        content: claim.claim_text,
        whyIncluded: "Directly linked claim",
        layer: "core",
      });
    }
  }
}

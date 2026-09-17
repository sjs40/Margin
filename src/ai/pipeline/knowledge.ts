import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { upsertEmbedding, knowledgeEmbeddingText } from "@/ai/pipeline/embeddings";
import { getOptionalProvider } from "@/ai/modelRouter";
import { logger } from "@/lib/logger";
import {
  canAutoOverwriteKnowledge,
  crossesAutoProposeThreshold,
  fallbackKnowledgeDisposition,
  isExactKnowledgeDuplicate,
  lexicalKnowledgeOverlap,
  type KnowledgeDisposition,
} from "@/lib/knowledge";
import type { CandidateFramework, CandidateInsight } from "@/ai/schemas/knowledge";
import type {
  KnowledgeKind,
  KnowledgeOrigin,
  KnowledgeRelationType,
  KnowledgeSourceRole,
  KnowledgeSourceType,
} from "@/types/domain";

type Admin = ReturnType<typeof createAdminClient>;

type ExistingObject = {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  body: string;
  state: string;
  origin: KnowledgeOrigin;
  user_edited: boolean;
};

export type PersistKnowledgeInput = {
  userId: string;
  noteId?: string;
  documentId?: string;
  origin: KnowledgeOrigin;
  entityIds: string[];
  themeIds: string[];
  claimIds: string[];
  candidateInsights: CandidateInsight[];
  candidateFrameworks: CandidateFramework[];
  active?: boolean;
  idempotent?: boolean;
};

async function existingKnowledgeLines(supabase: Admin, userId: string) {
  const { data } = await supabase
    .from("knowledge_objects")
    .select("id, kind, title, summary")
    .eq("user_id", userId)
    .in("state", ["proposed", "active"])
    .order("updated_at", { ascending: false })
    .limit(40);
  return data ?? [];
}

export async function loadExistingKnowledgeLines(userId: string) {
  return existingKnowledgeLines(createAdminClient(), userId);
}

async function hasOriginSource(
  supabase: Admin,
  userId: string,
  sourceType: "note" | "document",
  sourceId: string,
) {
  const { data } = await supabase
    .from("knowledge_object_sources")
    .select("id")
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("role", "origin")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function nextKnowledgeVersion(supabase: Admin, objectId: string) {
  const { data } = await supabase
    .from("knowledge_object_versions")
    .select("version_number")
    .eq("knowledge_object_id", objectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_number ?? 0) + 1;
}

export async function appendKnowledgeVersion(
  supabase: Admin,
  input: {
    userId: string;
    objectId: string;
    title: string;
    summary: string;
    body: string;
    changeSummary: string;
    origin: "user" | "ai" | "develop" | "import" | "backfill" | "merge";
  },
) {
  const version = await nextKnowledgeVersion(supabase, input.objectId);
  await supabase.from("knowledge_object_versions").insert({
    knowledge_object_id: input.objectId,
    user_id: input.userId,
    version_number: version,
    title: input.title,
    summary: input.summary,
    body: input.body,
    change_summary: input.changeSummary,
    origin: input.origin,
  });
}

export async function embedKnowledgeObject(
  supabase: Admin,
  userId: string,
  object: { id: string; title: string; summary: string; body: string; kind: string; state: string },
) {
  if (object.state !== "active" && object.state !== "proposed") return;
  await upsertEmbedding(supabase, {
    userId,
    sourceType: "knowledge_object",
    sourceId: object.id,
    chunkIndex: 0,
    content: knowledgeEmbeddingText(object),
    metadata: { kind: object.kind, state: object.state },
  });
}

async function linkEntitiesAndThemes(
  supabase: Admin,
  userId: string,
  objectId: string,
  entityIds: string[],
  themeIds: string[],
) {
  for (const entityId of entityIds) {
    await supabase.from("knowledge_object_entities").upsert(
      { knowledge_object_id: objectId, entity_id: entityId, user_id: userId },
      { onConflict: "knowledge_object_id,entity_id" },
    );
  }
  for (const themeId of themeIds) {
    await supabase.from("knowledge_object_themes").upsert(
      { knowledge_object_id: objectId, theme_id: themeId, user_id: userId },
      { onConflict: "knowledge_object_id,theme_id" },
    );
  }
}

export async function addKnowledgeSource(
  supabase: Admin,
  input: {
    userId: string;
    objectId: string;
    sourceType: KnowledgeSourceType;
    sourceId: string;
    role: KnowledgeSourceRole;
    excerpt?: string | null;
    rationale?: string | null;
    confidence?: number | null;
    createdBy: "user" | "ai";
  },
) {
  await supabase.from("knowledge_object_sources").upsert(
    {
      user_id: input.userId,
      knowledge_object_id: input.objectId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      role: input.role,
      excerpt: input.excerpt ?? null,
      rationale: input.rationale ?? null,
      confidence: input.confidence ?? null,
      created_by: input.createdBy,
    },
    { onConflict: "knowledge_object_id,source_type,source_id,role" },
  );
}

async function addRelationship(
  supabase: Admin,
  input: {
    userId: string;
    fromId: string;
    toId: string;
    relationType: KnowledgeRelationType;
    explanation: string;
    confidence: number | null;
    createdBy: "user" | "ai";
    state?: "proposed" | "accepted";
  },
) {
  if (input.fromId === input.toId) return;
  await supabase.from("knowledge_relationships").upsert(
    {
      user_id: input.userId,
      from_object_id: input.fromId,
      to_object_id: input.toId,
      relation_type: input.relationType,
      explanation: input.explanation,
      confidence: input.confidence,
      state: input.state ?? "proposed",
      created_by: input.createdBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "from_object_id,to_object_id,relation_type" },
  );
}

async function vectorScoresFor(
  userId: string,
  text: string,
): Promise<Array<{ id: string; similarity: number }>> {
  if (!getOptionalProvider()) return [];
  try {
    const embedded = await ai.embed(text);
    const supabase = createAdminClient();
    const { data } = await supabase.rpc("match_embeddings", {
      query_embedding: embedded.values,
      match_user_id: userId,
      match_count: 8,
    });
    if (!Array.isArray(data)) return [];
    return (data as Array<{ source_id: string; source_type: string; similarity: number }>)
      .filter((row) => row.source_type === "knowledge_object")
      .map((row) => ({ id: row.source_id, similarity: row.similarity }));
  } catch {
    return [];
  }
}

async function classifyCandidate(
  userId: string,
  candidate: { kind: KnowledgeKind; title: string; summary: string; body: string; entityIds: string[] },
  existing: ExistingObject[],
): Promise<{ decision: KnowledgeDisposition; existingObjectId: string | null }> {
  const exact = existing.find((row) =>
    isExactKnowledgeDuplicate(
      { kind: candidate.kind, title: candidate.title, summary: candidate.summary },
      { kind: row.kind, title: row.title, summary: row.summary },
    ),
  );
  if (exact) return { decision: "possible_duplicate", existingObjectId: exact.id };

  const lexical = existing.map((row) => ({
    row,
    score: lexicalKnowledgeOverlap(
      `${candidate.title} ${candidate.summary} ${candidate.body}`,
      `${row.title} ${row.summary} ${row.body}`,
    ),
  }));
  const vectors = await vectorScoresFor(
    userId,
    knowledgeEmbeddingText({ title: candidate.title, summary: candidate.summary, body: candidate.body }),
  );
  const maxLexical = Math.max(0, ...lexical.map((item) => item.score));
  const maxVector = Math.max(0, ...vectors.map((item) => item.similarity));
  const bestLexical = lexical.sort((a, b) => b.score - a.score)[0];
  const bestVector = vectors.sort((a, b) => b.similarity - a.similarity)[0];
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const overlapTarget = bestLexical?.score && bestLexical.score >= 0.3 ? bestLexical.row : existingById.get(bestVector?.id ?? "");

  let decision = fallbackKnowledgeDisposition({
    exactDuplicate: false,
    maxLexical,
    maxVector,
    entityOverlap: candidate.entityIds.length,
  });
  let existingObjectId = overlapTarget?.id ?? null;

  if (existing.length > 0 && (maxLexical >= 0.35 || maxVector >= 0.6)) {
    try {
      const classified = await ai.classifyKnowledge({
        candidate: `${candidate.kind}: ${candidate.title}\n${candidate.summary}\n${candidate.body}`,
        existing: existing
          .slice(0, 12)
          .map((row) => `${row.id} [${row.kind}] ${row.title}: ${row.summary}`)
          .join("\n"),
      });
      decision = classified.data.decision;
      if (classified.data.existingObjectId && existingById.has(classified.data.existingObjectId)) {
        existingObjectId = classified.data.existingObjectId;
      }
    } catch (error) {
      logger.warn("knowledge_classify_fallback", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return { decision, existingObjectId };
}

async function createProposedObject(
  supabase: Admin,
  input: PersistKnowledgeInput,
  object: {
    kind: KnowledgeKind;
    title: string;
    summary: string;
    body: string;
    maturity?: string | null;
  },
) {
  const now = new Date().toISOString();
  const state = input.active ? "active" : "proposed";
  const { data, error } = await supabase
    .from("knowledge_objects")
    .insert({
      user_id: input.userId,
      kind: object.kind,
      title: object.title,
      summary: object.summary,
      body: object.body,
      state,
      maturity: object.maturity ?? (object.kind === "framework" ? "emerging" : null),
      origin: input.origin,
      user_edited: false,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create knowledge object");
  await appendKnowledgeVersion(supabase, {
    userId: input.userId,
    objectId: data.id,
    title: object.title,
    summary: object.summary,
    body: object.body,
    changeSummary: input.active ? "Created" : "Proposed from source",
    origin: input.origin,
  });
  await linkEntitiesAndThemes(supabase, input.userId, data.id, input.entityIds, input.themeIds);
  if (input.noteId) {
    await addKnowledgeSource(supabase, {
      userId: input.userId,
      objectId: data.id,
      sourceType: "note",
      sourceId: input.noteId,
      role: "origin",
      createdBy: input.origin === "user" ? "user" : "ai",
    });
  }
  if (input.documentId) {
    await addKnowledgeSource(supabase, {
      userId: input.userId,
      objectId: data.id,
      sourceType: "document",
      sourceId: input.documentId,
      role: "origin",
      createdBy: input.origin === "user" ? "user" : "ai",
    });
  }
  for (const claimId of input.claimIds) {
    await addKnowledgeSource(supabase, {
      userId: input.userId,
      objectId: data.id,
      sourceType: "claim",
      sourceId: claimId,
      role: "support",
      createdBy: "ai",
    });
  }
  await embedKnowledgeObject(supabase, input.userId, data);
  return data as ExistingObject;
}

export async function persistExtractedKnowledge(input: PersistKnowledgeInput) {
  const supabase = createAdminClient();
  const sourceType = input.noteId ? "note" : input.documentId ? "document" : null;
  const sourceId = input.noteId ?? input.documentId;
  if (
    input.idempotent !== false &&
    sourceType &&
    sourceId &&
    (await hasOriginSource(supabase, input.userId, sourceType, sourceId))
  ) {
    return { created: 0, linked: 0, skipped: "already_extracted" as const };
  }

  const { data: existingRows } = await supabase
    .from("knowledge_objects")
    .select("id, kind, title, summary, body, state, origin, user_edited")
    .eq("user_id", input.userId)
    .in("state", ["proposed", "active"]);
  const existing = (existingRows ?? []) as ExistingObject[];

  let created = 0;
  let linked = 0;
  const insights = input.candidateInsights.filter((item) =>
    input.active ? true : crossesAutoProposeThreshold(item.confidence),
  );
  const frameworks = input.candidateFrameworks.filter((item) =>
    input.active ? true : crossesAutoProposeThreshold(item.confidence),
  );

  for (const insight of insights) {
    const candidate = {
      kind: "insight" as const,
      title: insight.title,
      summary: insight.summary,
      body: insight.rationale,
      entityIds: input.entityIds,
    };
    const { decision, existingObjectId } = await classifyCandidate(input.userId, candidate, existing);
    if (decision === "possible_duplicate" && existingObjectId) {
      const target = existing.find((row) => row.id === existingObjectId);
      if (target && isExactKnowledgeDuplicate(candidate, target)) {
        if (input.noteId) {
          await addKnowledgeSource(supabase, {
            userId: input.userId,
            objectId: target.id,
            sourceType: "note",
            sourceId: input.noteId,
            role: "support",
            createdBy: "ai",
            rationale: insight.rationale,
          });
        }
        if (input.documentId) {
          await addKnowledgeSource(supabase, {
            userId: input.userId,
            objectId: target.id,
            sourceType: "document",
            sourceId: input.documentId,
            role: "support",
            createdBy: "ai",
            rationale: insight.rationale,
          });
        }
        linked += 1;
        continue;
      }
    }
    if (decision === "possible_evidence" && existingObjectId) {
      const target = existing.find((row) => row.id === existingObjectId);
      if (target && !canAutoOverwriteKnowledge({
        userEdited: target.user_edited,
        origin: target.origin,
        state: target.state,
      })) {
        if (input.noteId) {
          await addKnowledgeSource(supabase, {
            userId: input.userId,
            objectId: target.id,
            sourceType: "note",
            sourceId: input.noteId,
            role: "support",
            createdBy: "ai",
            rationale: insight.rationale,
            confidence: insight.confidence,
          });
        }
        if (input.documentId) {
          await addKnowledgeSource(supabase, {
            userId: input.userId,
            objectId: target.id,
            sourceType: "document",
            sourceId: input.documentId,
            role: "support",
            createdBy: "ai",
            rationale: insight.rationale,
            confidence: insight.confidence,
          });
        }
        linked += 1;
        continue;
      }
    }
    const createdObject = await createProposedObject(supabase, input, {
      kind: "insight",
      title: insight.title,
      summary: insight.summary,
      body: insight.rationale,
    });
    created += 1;
    existing.push(createdObject);
    if (existingObjectId && (decision === "possible_duplicate" || decision === "possible_update")) {
      await addRelationship(supabase, {
        userId: input.userId,
        fromId: createdObject.id,
        toId: existingObjectId,
        relationType: decision === "possible_update" ? "refines" : "same_mechanism",
        explanation: insight.rationale,
        confidence: insight.confidence,
        createdBy: "ai",
      });
    }
  }

  for (const framework of frameworks) {
    const candidate = {
      kind: "framework" as const,
      title: framework.title,
      summary: framework.formulation,
      body: [framework.mechanism, ...framework.boundaryConditions].join("\n"),
      entityIds: input.entityIds,
    };
    const { decision, existingObjectId } = await classifyCandidate(input.userId, candidate, existing);
    if (decision === "possible_duplicate" && existingObjectId) {
      const target = existing.find((row) => row.id === existingObjectId);
      if (target && isExactKnowledgeDuplicate(candidate, { kind: target.kind, title: target.title, summary: target.summary })) {
        if (input.noteId) {
          await addKnowledgeSource(supabase, {
            userId: input.userId,
            objectId: target.id,
            sourceType: "note",
            sourceId: input.noteId,
            role: "support",
            createdBy: "ai",
            rationale: framework.mechanism,
          });
        }
        if (input.documentId) {
          await addKnowledgeSource(supabase, {
            userId: input.userId,
            objectId: target.id,
            sourceType: "document",
            sourceId: input.documentId,
            role: "support",
            createdBy: "ai",
            rationale: framework.mechanism,
          });
        }
        linked += 1;
        continue;
      }
    }
    const createdObject = await createProposedObject(supabase, input, {
      kind: "framework",
      title: framework.title,
      summary: framework.formulation,
      body: `${framework.mechanism}\n\nBoundary conditions:\n${framework.boundaryConditions.map((item) => `- ${item}`).join("\n")}`,
      maturity: "emerging",
    });
    created += 1;
    existing.push(createdObject);
    const originId = input.noteId ?? input.documentId;
    if (originId) {
      for (const condition of framework.boundaryConditions) {
        await addKnowledgeSource(supabase, {
          userId: input.userId,
          objectId: createdObject.id,
          sourceType: input.noteId ? "note" : "document",
          sourceId: originId,
          role: "boundary_condition",
          excerpt: condition,
          createdBy: "ai",
        });
      }
    }
    if (existingObjectId && (decision === "possible_duplicate" || decision === "possible_update")) {
      await addRelationship(supabase, {
        userId: input.userId,
        fromId: createdObject.id,
        toId: existingObjectId,
        relationType: decision === "possible_update" ? "extends" : "same_mechanism",
        explanation: framework.mechanism,
        confidence: framework.confidence,
        createdBy: "ai",
      });
    }
  }

  return {
    created,
    linked,
    skipped:
      input.candidateInsights.length -
      insights.length +
      (input.candidateFrameworks.length - frameworks.length),
  };
}

export async function resolveKnowledgeByNoteIds(
  userId: string,
  noteIds: string[],
): Promise<Map<string, string>> {
  if (noteIds.length === 0) return new Map();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("knowledge_object_sources")
    .select("knowledge_object_id, source_id")
    .eq("user_id", userId)
    .eq("source_type", "note")
    .in("source_id", noteIds);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!map.has(row.source_id)) map.set(row.source_id, row.knowledge_object_id);
  }
  return map;
}

export async function proposeRelationshipFromNotes(
  userId: string,
  input: {
    fromNoteId: string | null;
    toNoteId: string | null;
    relationType: KnowledgeRelationType;
    explanation: string;
    confidence: number;
  },
) {
  if (!input.fromNoteId || !input.toNoteId || input.fromNoteId === input.toNoteId) {
    logger.info("ungrounded_connection", { reason: "missing_note_ids" });
    return false;
  }
  const resolved = await resolveKnowledgeByNoteIds(userId, [input.fromNoteId, input.toNoteId]);
  const fromId = resolved.get(input.fromNoteId);
  const toId = resolved.get(input.toNoteId);
  if (!fromId || !toId) {
    logger.info("ungrounded_connection", { fromNoteId: input.fromNoteId, toNoteId: input.toNoteId });
    return false;
  }
  await addRelationship(createAdminClient(), {
    userId,
    fromId,
    toId,
    relationType: input.relationType,
    explanation: input.explanation,
    confidence: input.confidence,
    createdBy: "ai",
  });
  return true;
}

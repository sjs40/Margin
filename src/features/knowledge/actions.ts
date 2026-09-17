"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addKnowledgeSource,
  appendKnowledgeVersion,
  embedKnowledgeObject,
} from "@/ai/pipeline/knowledge";
import { withUserAi } from "@/lib/ai-credentials";
import type {
  KnowledgeKind,
  KnowledgeSourceRole,
  KnowledgeSourceType,
} from "@/types/domain";

function revalidateKnowledge(id?: string) {
  revalidatePath("/research");
  revalidatePath("/research/knowledge");
  if (id) revalidatePath(`/research/knowledge/${id}`);
}

async function assertOwnedSource(
  userId: string,
  sourceType: KnowledgeSourceType,
  sourceId: string,
) {
  const supabase = createAdminClient();
  switch (sourceType) {
    case "note": {
      const { data } = await supabase.from("notes").select("id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
      return Boolean(data);
    }
    case "document": {
      const { data } = await supabase.from("documents").select("id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
      return Boolean(data);
    }
    case "meta_note": {
      const { data } = await supabase.from("meta_notes").select("id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
      return Boolean(data);
    }
    case "claim": {
      const { data } = await supabase.from("claims").select("id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
      return Boolean(data);
    }
    case "knowledge_object": {
      const { data } = await supabase
        .from("knowledge_objects")
        .select("id")
        .eq("id", sourceId)
        .eq("user_id", userId)
        .maybeSingle();
      return Boolean(data);
    }
    default: {
      const exhaustive: never = sourceType;
      return exhaustive;
    }
  }
}

export async function createKnowledgeObject(input: {
  kind: KnowledgeKind;
  title: string;
  summary: string;
  body: string;
}) {
  const { supabase, user } = await requireUser();
  const title = input.title.trim();
  const summary = input.summary.trim();
  if (!title || !summary) return { error: "Title and summary are required." };
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("knowledge_objects")
    .insert({
      user_id: user.id,
      kind: input.kind,
      title,
      summary,
      body: input.body.trim(),
      state: "active",
      origin: "user",
      user_edited: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create." };
  const admin = createAdminClient();
  await appendKnowledgeVersion(admin, {
    userId: user.id,
    objectId: data.id,
    title,
    summary,
    body: input.body.trim(),
    changeSummary: "User created",
    origin: "user",
  });
  await withUserAi(user.id, { consume: false }, async () => {
    await embedKnowledgeObject(admin, user.id, data);
  });
  revalidateKnowledge(data.id);
  return { ok: true, id: data.id };
}

export async function updateKnowledgeObject(input: {
  id: string;
  title: string;
  summary: string;
  body: string;
  changeSummary?: string;
}) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("knowledge_objects")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "Not found." };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("knowledge_objects")
    .update({
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      user_edited: true,
      updated_at: now,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  const admin = createAdminClient();
  await appendKnowledgeVersion(admin, {
    userId: user.id,
    objectId: input.id,
    title: input.title.trim(),
    summary: input.summary.trim(),
    body: input.body.trim(),
    changeSummary: input.changeSummary?.trim() || "User edit",
    origin: "user",
  });
  await withUserAi(user.id, { consume: false }, async () => {
    await embedKnowledgeObject(admin, user.id, {
      ...existing,
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
    });
  });
  revalidateKnowledge(input.id);
  return { ok: true };
}

export async function setKnowledgeState(id: string, state: "active" | "archived" | "proposed") {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("knowledge_objects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "Not found." };
  const { error } = await supabase
    .from("knowledge_objects")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  const admin = createAdminClient();
  await appendKnowledgeVersion(admin, {
    userId: user.id,
    objectId: id,
    title: existing.title,
    summary: existing.summary,
    body: existing.body,
    changeSummary: `State → ${state}`,
    origin: "user",
  });
  revalidateKnowledge(id);
  return { ok: true };
}

export async function mergeKnowledgeObject(sourceId: string, targetId: string) {
  const { supabase, user } = await requireUser();
  if (sourceId === targetId) return { error: "Pick a different object." };
  const { data: source } = await supabase
    .from("knowledge_objects")
    .select("*")
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .single();
  const { data: target } = await supabase
    .from("knowledge_objects")
    .select("*")
    .eq("id", targetId)
    .eq("user_id", user.id)
    .single();
  if (!source || !target) return { error: "Both objects must exist." };
  const admin = createAdminClient();
  await admin
    .from("knowledge_object_sources")
    .update({ knowledge_object_id: targetId })
    .eq("knowledge_object_id", sourceId)
    .eq("user_id", user.id);
  await admin.from("knowledge_objects").update({
    state: "merged",
    merged_into_id: targetId,
    updated_at: new Date().toISOString(),
  }).eq("id", sourceId).eq("user_id", user.id);
  await appendKnowledgeVersion(admin, {
    userId: user.id,
    objectId: targetId,
    title: target.title,
    summary: target.summary,
    body: target.body,
    changeSummary: `Merged ${source.title}`,
    origin: "merge",
  });
  revalidateKnowledge(targetId);
  revalidateKnowledge(sourceId);
  return { ok: true, targetId };
}

export async function addOwnedKnowledgeSource(input: {
  objectId: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  role: KnowledgeSourceRole;
  excerpt?: string;
  rationale?: string;
}) {
  const { user } = await requireUser();
  const owned = await assertOwnedSource(user.id, input.sourceType, input.sourceId);
  if (!owned) return { error: "Source not found." };
  await addKnowledgeSource(createAdminClient(), {
    userId: user.id,
    objectId: input.objectId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    role: input.role,
    excerpt: input.excerpt,
    rationale: input.rationale,
    createdBy: "user",
  });
  revalidateKnowledge(input.objectId);
  return { ok: true };
}

export async function updateKnowledgeSourceRole(id: string, role: KnowledgeSourceRole) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("knowledge_object_sources")
    .update({ role })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidateKnowledge();
  return { ok: true };
}

export async function removeKnowledgeSource(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("knowledge_object_sources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidateKnowledge();
  return { ok: true };
}

export async function setKnowledgeRelationshipState(
  id: string,
  state: "accepted" | "rejected" | "proposed",
) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("knowledge_relationships")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidateKnowledge();
  return { ok: true };
}

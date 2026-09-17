import { createClient } from "@/lib/supabase/server";
import { evidenceStats, type EvidenceSource } from "@/lib/knowledge";
import type { KnowledgeKind, KnowledgeState } from "@/types/domain";

export type KnowledgeListFilters = {
  tab: "insights" | "frameworks" | "proposed" | "archived";
  q?: string;
};

export type KnowledgeListRow = {
  id: string;
  kind: KnowledgeKind;
  state: KnowledgeState;
  title: string;
  summary: string;
  maturity: string | null;
  origin: string;
  user_edited: boolean;
  updated_at: string;
  companies: Array<{ id: string; label: string }>;
  themes: Array<{ id: string; name: string }>;
  stats: ReturnType<typeof evidenceStats>;
  provenanceCount: number;
};

export async function listKnowledgeObjects(filters: KnowledgeListFilters): Promise<KnowledgeListRow[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  let query = supabase
    .from("knowledge_objects")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });
  if (filters.tab === "insights") query = query.eq("kind", "insight").eq("state", "active");
  else if (filters.tab === "frameworks") query = query.eq("kind", "framework").eq("state", "active");
  else if (filters.tab === "proposed") query = query.eq("state", "proposed");
  else query = query.eq("state", "archived");
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);
  }
  const { data } = await query.limit(80);
  const ids = (data ?? []).map((row) => row.id);
  if (ids.length === 0) return [];
  const [{ data: sources }, { data: entities }, { data: themes }] = await Promise.all([
    supabase
      .from("knowledge_object_sources")
      .select("knowledge_object_id, role, source_type, source_id, created_at")
      .eq("user_id", auth.user.id)
      .in("knowledge_object_id", ids),
    supabase
      .from("knowledge_object_entities")
      .select("knowledge_object_id, entities(id, ticker, canonical_name)")
      .eq("user_id", auth.user.id)
      .in("knowledge_object_id", ids),
    supabase
      .from("knowledge_object_themes")
      .select("knowledge_object_id, themes(id, name)")
      .eq("user_id", auth.user.id)
      .in("knowledge_object_id", ids),
  ]);
  return (data ?? []).map((row) => {
    const objectSources = (sources ?? []).filter((source) => source.knowledge_object_id === row.id);
    const linkedEntities = (entities ?? []).filter((link) => link.knowledge_object_id === row.id);
    const linkedThemes = (themes ?? []).filter((link) => link.knowledge_object_id === row.id);
    const stats = evidenceStats(
      objectSources.map((source) => ({
        role: source.role,
        sourceType: source.source_type,
        sourceId: source.source_id,
        createdAt: source.created_at,
      })) as EvidenceSource[],
      linkedEntities.map((link) => {
        const entity = Array.isArray(link.entities) ? link.entities[0] : link.entities;
        return entity?.id;
      }).filter(Boolean) as string[],
    );
    return {
      ...row,
      kind: row.kind as KnowledgeKind,
      state: row.state as KnowledgeState,
      companies: linkedEntities.flatMap((link) => {
        const entity = Array.isArray(link.entities) ? link.entities[0] : link.entities;
        return entity ? [{ id: entity.id, label: entity.ticker || entity.canonical_name }] : [];
      }),
      themes: linkedThemes.flatMap((link) => {
        const theme = Array.isArray(link.themes) ? link.themes[0] : link.themes;
        return theme ? [{ id: theme.id, name: theme.name }] : [];
      }),
      stats,
      provenanceCount: objectSources.length,
    };
  });
}

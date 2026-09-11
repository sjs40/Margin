import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { getOptionalProvider } from "@/ai/modelRouter";
import {
  chunkIds,
  formatMemoryContext,
  groupTickersByOwner,
  hybridScore,
  lexicalScore,
  looksLikeTickerQuery,
  mergeVectorHits,
  missingVectorIdsBySourceType,
  recencyScore,
  tickerEntityScore,
  type RankedHit,
  type VectorMatch,
} from "@/lib/ranking";

const RECENCY_NOTE_LIMIT = 80;
const RECENCY_DOCUMENT_LIMIT = 40;
const VECTOR_MATCH_COUNT = 40;
const TICKER_NOTE_CAP = 200;
const IN_FILTER_CHUNK = 100;

const NOTE_COLUMNS = "id, title, raw_text, interpreted_text, source_type, captured_at";
const DOCUMENT_COLUMNS = "id, title, raw_content, interpreted_content, document_type, captured_at";

type Admin = ReturnType<typeof createAdminClient>;

type NoteRow = {
  id: string;
  title: string | null;
  raw_text: string | null;
  interpreted_text: string | null;
  source_type: string;
  captured_at: string;
};

type DocumentRow = {
  id: string;
  title: string | null;
  raw_content: string;
  interpreted_content: string | null;
  document_type: string;
  captured_at: string;
};

type NestedEntity = { ticker?: string | null } | Array<{ ticker?: string | null }> | null;

type MatchEmbeddingRow = {
  source_id: string;
  source_type: string;
  content: string;
  similarity: number;
};

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

function tickerFromNested(entities: NestedEntity): string | undefined {
  const entity = Array.isArray(entities) ? entities[0] : entities;
  return entity?.ticker ?? undefined;
}

function noteHit(note: NoteRow, query: string, tickers: string[]): RankedHit {
  const text = `${note.title ?? ""} ${note.interpreted_text ?? ""} ${note.raw_text ?? ""}`;
  return {
    id: note.id,
    kind: "note",
    title: note.title || (note.raw_text ?? "Untitled note").slice(0, 80),
    snippet: (note.interpreted_text || note.raw_text || "").slice(0, 220),
    date: note.captured_at,
    sourceType: note.source_type,
    tickers,
    entityScore: tickerEntityScore(query, tickers),
    lexicalScore: lexicalScore(query, text),
    vectorScore: 0,
    recencyScore: recencyScore(note.captured_at),
  };
}

function documentHit(document: DocumentRow, query: string, tickers: string[]): RankedHit {
  const text = `${document.title ?? ""} ${document.interpreted_content ?? ""} ${document.raw_content}`;
  return {
    id: document.id,
    kind: "document",
    title: document.title || "Untitled document",
    snippet: (document.interpreted_content || document.raw_content).slice(0, 220),
    date: document.captured_at,
    sourceType: document.document_type,
    tickers,
    entityScore: tickerEntityScore(query, tickers),
    lexicalScore: lexicalScore(query, text),
    vectorScore: 0,
    recencyScore: recencyScore(document.captured_at),
  };
}

async function fetchInChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const parts = await Promise.all(chunkIds(ids, IN_FILTER_CHUNK).map(fetchChunk));
  return parts.flat();
}

async function fetchNotesByIds(supabase: Admin, userId: string, ids: string[]): Promise<NoteRow[]> {
  return fetchInChunks(ids, async (chunk) => {
    const { data } = await supabase
      .from("notes")
      .select(NOTE_COLUMNS)
      .eq("user_id", userId)
      .in("id", chunk);
    return (data ?? []) as NoteRow[];
  });
}

async function fetchDocumentsByIds(
  supabase: Admin,
  userId: string,
  ids: string[],
): Promise<DocumentRow[]> {
  return fetchInChunks(ids, async (chunk) => {
    const { data } = await supabase
      .from("documents")
      .select(DOCUMENT_COLUMNS)
      .eq("user_id", userId)
      .in("id", chunk);
    return (data ?? []) as DocumentRow[];
  });
}

async function fetchTickerLinkedNotes(
  supabase: Admin,
  userId: string,
  ticker: string,
): Promise<NoteRow[]> {
  const { data: entity } = await supabase
    .from("entities")
    .select("id")
    .eq("ticker", ticker)
    .maybeSingle();
  if (!entity) return [];

  const { data } = await supabase
    .from("notes")
    .select(`${NOTE_COLUMNS}, note_entities!inner(entity_id)`)
    .eq("user_id", userId)
    .eq("note_entities.entity_id", entity.id)
    .order("captured_at", { ascending: false })
    .limit(TICKER_NOTE_CAP);
  return (data ?? []) as NoteRow[];
}

async function fetchNoteTickers(supabase: Admin, noteIds: string[]): Promise<Map<string, string[]>> {
  const links = await fetchInChunks(noteIds, async (chunk) => {
    const { data } = await supabase
      .from("note_entities")
      .select("note_id, entities(ticker)")
      .in("note_id", chunk);
    return data ?? [];
  });
  return groupTickersByOwner(
    links.map((link) => ({
      ownerId: link.note_id as string,
      ticker: tickerFromNested(link.entities as NestedEntity),
    })),
  );
}

async function fetchDocumentTickers(
  supabase: Admin,
  documentIds: string[],
): Promise<Map<string, string[]>> {
  const links = await fetchInChunks(documentIds, async (chunk) => {
    const { data } = await supabase
      .from("document_entities")
      .select("document_id, entities(ticker)")
      .in("document_id", chunk);
    return data ?? [];
  });
  return groupTickersByOwner(
    links.map((link) => ({
      ownerId: link.document_id as string,
      ticker: tickerFromNested(link.entities as NestedEntity),
    })),
  );
}

async function matchQueryVectors(
  supabase: Admin,
  userId: string,
  query: string,
): Promise<VectorMatch[]> {
  const provider = getOptionalProvider();
  if (!provider) return [];
  try {
    const embedded = await ai.embed(query);
    const { data: vectors } = await supabase.rpc("match_embeddings", {
      query_embedding: embedded.values,
      match_user_id: userId,
      match_count: VECTOR_MATCH_COUNT,
    });
    if (!Array.isArray(vectors)) return [];
    return (vectors as MatchEmbeddingRow[]).map((row) => ({
      sourceId: row.source_id,
      sourceType: row.source_type,
      similarity: row.similarity,
    })) satisfies VectorMatch[];
  } catch {
    // Vector search is optional; lexical/entity still work.
    return [];
  }
}

export async function hybridSearch(userId: string, query: string): Promise<RankedHit[]> {
  const supabase = createAdminClient();
  const tickerQuery = looksLikeTickerQuery(query);
  const ticker = tickerQuery ? query.trim().toUpperCase() : null;

  const [{ data: recentNotes }, { data: recentDocuments }, { data: companies }, { data: themes }] =
    await Promise.all([
      supabase
        .from("notes")
        .select(NOTE_COLUMNS)
        .eq("user_id", userId)
        .order("captured_at", { ascending: false })
        .limit(RECENCY_NOTE_LIMIT),
      supabase
        .from("documents")
        .select(DOCUMENT_COLUMNS)
        .eq("user_id", userId)
        .order("captured_at", { ascending: false })
        .limit(RECENCY_DOCUMENT_LIMIT),
      supabase.from("entities").select("id, ticker, canonical_name").eq("entity_type", "company"),
      supabase.from("themes").select("id, name, description").eq("user_id", userId),
    ]);

  let noteRows = uniqueById((recentNotes ?? []) as NoteRow[]);
  let documentRows = uniqueById((recentDocuments ?? []) as DocumentRow[]);

  if (ticker) {
    const linkedNotes = await fetchTickerLinkedNotes(supabase, userId, ticker);
    noteRows = uniqueById([...noteRows, ...linkedNotes]);
  }

  const companyHits: RankedHit[] = (companies ?? []).map((company) => {
    const text = `${company.ticker ?? ""} ${company.canonical_name}`;
    return {
      id: company.id,
      kind: "company" as const,
      title: company.ticker ? `${company.ticker} · ${company.canonical_name}` : company.canonical_name,
      snippet: company.canonical_name,
      tickers: company.ticker ? [company.ticker] : [],
      entityScore:
        tickerQuery && company.ticker === query.trim().toUpperCase() ? 1 : lexicalScore(query, text),
      lexicalScore: lexicalScore(query, text),
      vectorScore: 0,
      recencyScore: 0.5,
    };
  });
  const themeHits: RankedHit[] = (themes ?? []).map((theme) => ({
    id: theme.id,
    kind: "theme" as const,
    title: theme.name,
    snippet: theme.description ?? "",
    entityScore: 0,
    lexicalScore: lexicalScore(query, `${theme.name} ${theme.description ?? ""}`),
    vectorScore: 0,
    recencyScore: 0.5,
  }));

  const seededIds = [
    ...noteRows.map((note) => ({ id: note.id })),
    ...documentRows.map((document) => ({ id: document.id })),
    ...companyHits.map((hit) => ({ id: hit.id })),
    ...themeHits.map((hit) => ({ id: hit.id })),
  ];
  const vectors = await matchQueryVectors(supabase, userId, query);
  const [extraNotes, extraDocuments] = await Promise.all([
    fetchNotesByIds(supabase, userId, missingVectorIdsBySourceType(seededIds, vectors, "note")),
    fetchDocumentsByIds(
      supabase,
      userId,
      missingVectorIdsBySourceType(seededIds, vectors, "document"),
    ),
  ]);
  noteRows = uniqueById([...noteRows, ...extraNotes]);
  documentRows = uniqueById([...documentRows, ...extraDocuments]);

  const [noteTickers, documentTickers] = await Promise.all([
    fetchNoteTickers(
      supabase,
      noteRows.map((note) => note.id),
    ),
    fetchDocumentTickers(
      supabase,
      documentRows.map((document) => document.id),
    ),
  ]);

  const hits: RankedHit[] = [
    ...noteRows.map((note) => noteHit(note, query, noteTickers.get(note.id) ?? [])),
    ...documentRows.map((document) =>
      documentHit(document, query, documentTickers.get(document.id) ?? []),
    ),
    ...companyHits,
    ...themeHits,
  ];

  return mergeVectorHits(hits, vectors)
    .map((hit) => ({ ...hit, score: hybridScore(hit, query) }))
    .filter((hit) => hybridScore(hit, query) > 0.12)
    .sort((a, b) => hybridScore(b, query) - hybridScore(a, query))
    .slice(0, 30);
}

export async function askFromMemory(userId: string, question: string) {
  const hits = await hybridSearch(userId, question);
  const context = formatMemoryContext(hits);
  const answer = await ai.answerFromMemory({ question, context });
  return { answer: answer.data, hits };
}

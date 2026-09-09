import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/ai/operations";
import { getOptionalProvider } from "@/ai/modelRouter";
import {
  hybridScore,
  lexicalScore,
  looksLikeTickerQuery,
  recencyScore,
  type RankedHit,
} from "@/lib/ranking";

export async function hybridSearch(userId: string, query: string): Promise<RankedHit[]> {
  const supabase = createAdminClient();
  const tickerQuery = looksLikeTickerQuery(query);
  const hits: RankedHit[] = [];

  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, raw_text, interpreted_text, source_type, captured_at")
    .eq("user_id", userId)
    .order("captured_at", { ascending: false })
    .limit(80);

  for (const note of notes ?? []) {
    const text = `${note.title ?? ""} ${note.interpreted_text ?? ""} ${note.raw_text ?? ""}`;
    const { data: entityLinks } = await supabase
      .from("note_entities")
      .select("entities(ticker, canonical_name)")
      .eq("note_id", note.id);
    const tickers = (entityLinks ?? [])
      .map((link) => {
        const entity = Array.isArray(link.entities) ? link.entities[0] : link.entities;
        return entity?.ticker as string | undefined;
      })
      .filter((value): value is string => Boolean(value));
    hits.push({
      id: note.id,
      kind: "note",
      title: note.title || (note.raw_text ?? "Untitled note").slice(0, 80),
      snippet: (note.interpreted_text || note.raw_text || "").slice(0, 220),
      date: note.captured_at,
      sourceType: note.source_type,
      tickers,
      entityScore: tickerQuery && tickers.includes(query.trim().toUpperCase()) ? 1 : 0,
      lexicalScore: lexicalScore(query, text),
      vectorScore: 0,
      recencyScore: recencyScore(note.captured_at),
    });
  }

  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, raw_content, interpreted_content, document_type, captured_at")
    .eq("user_id", userId)
    .limit(40);
  for (const document of documents ?? []) {
    const text = `${document.title ?? ""} ${document.interpreted_content ?? ""} ${document.raw_content}`;
    hits.push({
      id: document.id,
      kind: "document",
      title: document.title || "Untitled document",
      snippet: (document.interpreted_content || document.raw_content).slice(0, 220),
      date: document.captured_at,
      sourceType: document.document_type,
      entityScore: 0,
      lexicalScore: lexicalScore(query, text),
      vectorScore: 0,
      recencyScore: recencyScore(document.captured_at),
    });
  }

  const { data: companies } = await supabase
    .from("entities")
    .select("id, ticker, canonical_name")
    .eq("entity_type", "company");
  for (const company of companies ?? []) {
    const text = `${company.ticker ?? ""} ${company.canonical_name}`;
    hits.push({
      id: company.id,
      kind: "company",
      title: company.ticker ? `${company.ticker} · ${company.canonical_name}` : company.canonical_name,
      snippet: company.canonical_name,
      tickers: company.ticker ? [company.ticker] : [],
      entityScore:
        tickerQuery && company.ticker === query.trim().toUpperCase() ? 1 : lexicalScore(query, text),
      lexicalScore: lexicalScore(query, text),
      vectorScore: 0,
      recencyScore: 0.5,
    });
  }

  const { data: themes } = await supabase
    .from("themes")
    .select("id, name, description")
    .eq("user_id", userId);
  for (const theme of themes ?? []) {
    hits.push({
      id: theme.id,
      kind: "theme",
      title: theme.name,
      snippet: theme.description ?? "",
      entityScore: 0,
      lexicalScore: lexicalScore(query, `${theme.name} ${theme.description ?? ""}`),
      vectorScore: 0,
      recencyScore: 0.5,
    });
  }

  const provider = getOptionalProvider();
  if (provider) {
    try {
      const embedded = await ai.embed(query);
      const { data: vectors } = await supabase.rpc("match_embeddings", {
        query_embedding: embedded.values,
        match_user_id: userId,
        match_count: 20,
      });
      if (Array.isArray(vectors)) {
        for (const row of vectors as Array<{
          source_id: string;
          source_type: string;
          content: string;
          similarity: number;
        }>) {
          const existing = hits.find((hit) => hit.id === row.source_id);
          if (existing) existing.vectorScore = Math.max(existing.vectorScore, row.similarity);
        }
      }
    } catch {
      // Vector search is optional; lexical/entity still work.
    }
  }

  return hits
    .map((hit) => ({ ...hit, score: hybridScore(hit, query) }))
    .filter((hit) => hybridScore(hit, query) > 0.12)
    .sort((a, b) => hybridScore(b, query) - hybridScore(a, query))
    .slice(0, 30);
}

export async function askFromMemory(userId: string, question: string) {
  const hits = await hybridSearch(userId, question);
  const context = hits
    .slice(0, 12)
    .map(
      (hit) =>
        `SOURCE id=${hit.id} kind=${hit.kind} date=${hit.date ?? ""} title=${hit.title}\n${hit.snippet}`,
    )
    .join("\n\n");
  const answer = await ai.answerFromMemory({ question, context });
  return { answer: answer.data, hits };
}

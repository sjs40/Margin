import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { fetchQuote } from "@/lib/prices/provider";

type Admin = ReturnType<typeof createAdminClient>;

export async function stampNotePrices(supabase: Admin, noteId: string) {
  const { data: rows } = await supabase
    .from("note_entities")
    .select("entity_id, relationship_type, entities(ticker, entity_type)")
    .eq("note_id", noteId);
  const companies = (rows ?? [])
    .map((row) => {
      const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
      return {
        entityId: row.entity_id,
        relationshipType: row.relationship_type,
        ticker: entity?.ticker ?? null,
        entityType: entity?.entity_type ?? null,
      };
    })
    .filter((row) => row.entityType === "company" && row.ticker);

  await Promise.all(
    companies.map(async (row) => {
      const quote = await fetchQuote(row.ticker!, { timeoutMs: 3000, revalidateSeconds: false });
      if (!quote) {
        logger.warn("price_stamp_failed", { objectId: noteId, ticker: row.ticker });
        return;
      }
      const { error } = await supabase
        .from("note_entities")
        .update({
          price_at_capture: quote.price,
          price_currency: quote.currency,
          price_as_of: quote.asOf,
          price_provider: quote.provider,
        })
        .eq("note_id", noteId)
        .eq("entity_id", row.entityId)
        .eq("relationship_type", row.relationshipType);
      if (error) logger.warn("price_stamp_update_failed", { objectId: noteId, ticker: row.ticker });
    }),
  );
}

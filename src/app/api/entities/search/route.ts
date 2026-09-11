import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 1) return NextResponse.json([]);
    logger.info("entity_search", { qLength: q.length });
    const { data, error } = await supabase.rpc("search_companies", { q, lim: 8 });
    if (error) return NextResponse.json([]);
    return NextResponse.json(
      (data ?? []).map((row: { id: string; ticker: string | null; canonical_name: string }) => ({
        id: row.id,
        ticker: row.ticker,
        name: row.canonical_name,
      })),
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

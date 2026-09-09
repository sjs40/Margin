import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { hybridSearch } from "@/ai/pipeline/search";
import { withUserAi } from "@/lib/ai-credentials";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim() ?? "";
    if (!query) return NextResponse.json({ hits: [] });
    logger.info("search_started", { userId: user.id });
    const bound = await withUserAi(user.id, { consume: false, allowHosted: false }, () =>
      hybridSearch(user.id, query),
    );
    const hits = bound.ok ? bound.result : await hybridSearch(user.id, query);
    return NextResponse.json({ hits });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

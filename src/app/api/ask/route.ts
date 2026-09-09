import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { askFromMemory } from "@/ai/pipeline/search";
import { aiSkipMessage, withUserAi } from "@/lib/ai-credentials";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim() ?? "";
    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });
    logger.info("ask_started", { userId: user.id });
    const bound = await withUserAi(user.id, { consume: true }, () => askFromMemory(user.id, query));
    if (!bound.ok) {
      return NextResponse.json({ error: aiSkipMessage(bound.reason) }, { status: 429 });
    }
    return NextResponse.json(bound.result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { askFromMemory } from "@/ai/pipeline/search";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim() ?? "";
    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });
    logger.info("ask_started", { userId: user.id });
    const result = await askFromMemory(user.id, query);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

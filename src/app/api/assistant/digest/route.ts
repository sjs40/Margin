import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * Assistant digest endpoint.
 * GET /api/assistant/digest?days=2
 * Auth: Authorization: Bearer <MARGIN_ASSISTANT_TOKEN>
 * Returns the latest daily meta-note + recent notes as JSON.
 */
export async function GET(request: Request) {
  const expected = process.env.MARGIN_ASSISTANT_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Assistant access not configured" }, { status: 501 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const ok =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    Math.max(parseInt(new URL(request.url).searchParams.get("days") ?? "2", 10) || 2, 1),
    14,
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = createAdminClient();
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, email");
    if (userError) throw new Error(userError.message);

    const users_out = [];
    for (const user of users ?? []) {
      const [{ data: daily }, { data: notes }] = await Promise.all([
        supabase
          .from("meta_notes")
          .select("date, title, current_content, updated_at")
          .eq("user_id", user.id)
          .eq("meta_type", "daily")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("notes")
          .select("id, title, interpreted_text, raw_text, captured_at")
          .eq("user_id", user.id)
          .gte("captured_at", since)
          .order("captured_at", { ascending: false })
          .limit(50),
      ]);
      users_out.push({
        user_id: user.id,
        email: user.email,
        daily_note: daily
          ? {
              date: daily.date,
              title: daily.title,
              content: daily.current_content,
              updated_at: daily.updated_at,
            }
          : null,
        recent_notes: (notes ?? []).map((n) => ({
          id: n.id,
          title: n.title,
          text: n.interpreted_text ?? n.raw_text,
          captured_at: n.captured_at,
        })),
      });
    }

    return NextResponse.json({ generated_at: new Date().toISOString(), users: users_out });
  } catch (error) {
    logger.error("assistant_digest_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Failed to build digest" }, { status: 500 });
  }
}

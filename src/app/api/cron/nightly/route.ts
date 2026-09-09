import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runNightlyIntelligence } from "@/ai/pipeline/memory";
import { withUserAi } from "@/lib/ai-credentials";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  logger.info("nightly_cron_started", {});
  const supabase = createAdminClient();
  const { data: users, error } = await supabase.from("users").select("id");
  if (error) {
    logger.error("nightly_cron_failed", { reason: "user_lookup" });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let ran = 0;
  for (const user of users ?? []) {
    const bound = await withUserAi(user.id, { consume: false, allowHosted: false }, () =>
      runNightlyIntelligence(user.id),
    );
    if (bound.ok) ran += 1;
  }
  logger.info("nightly_cron_completed", { count: ran });
  return NextResponse.json({ ok: true, users: users?.length ?? 0, ran });
}

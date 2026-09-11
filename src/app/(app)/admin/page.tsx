import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/env";
import { AdminControls } from "@/features/admin/admin-controls";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!isAdminEmail(data.user?.email)) notFound();

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("app_settings")
    .select("hosted_ai_enabled")
    .eq("id", 1)
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRows } = await admin
    .from("ai_daily_usage")
    .select("user_id, action_count")
    .eq("usage_date", today)
    .order("action_count", { ascending: false });
  const userIds = (usageRows ?? []).map((row) => row.user_id);
  const { data: users } =
    userIds.length > 0
      ? await admin.from("users").select("id, email").in("id", userIds)
      : { data: [] };
  const emailById = new Map((users ?? []).map((row) => [row.id, row.email]));
  const usage = (usageRows ?? []).map((row) => ({
    email: emailById.get(row.user_id) ?? null,
    action_count: row.action_count,
  }));

  const { count: secCount } = await admin
    .from("entities")
    .select("id", { count: "exact", head: true })
    .eq("source", "sec");
  const { data: latestSec } = await admin
    .from("entities")
    .select("last_synced_at")
    .eq("source", "sec")
    .not("last_synced_at", "is", null)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: userCount } = await admin.from("users").select("id", { count: "exact", head: true });
  const { data: settingRows } = await admin
    .from("user_settings")
    .select("contradiction_detection_enabled, contradiction_min_confidence, contradiction_prior_claims_limit");
  const grouped = new Map<string, {
    enabled: boolean;
    minConfidence: number;
    priorLimit: number;
    users: number;
  }>();
  for (const row of settingRows ?? []) {
    const enabled = Boolean(row.contradiction_detection_enabled);
    const minConfidence = Number(row.contradiction_min_confidence);
    const priorLimit = Number(row.contradiction_prior_claims_limit);
    const key = `${enabled}:${minConfidence}:${priorLimit}`;
    const current = grouped.get(key) ?? { enabled, minConfidence, priorLimit, users: 0 };
    current.users += 1;
    grouped.set(key, current);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl">Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Control the hosted Gemini trial. Your own account is unlimited on the server key.
      </p>
      <div className="mt-8">
        <AdminControls
          hostedEnabled={settings?.hosted_ai_enabled ?? true}
          usage={usage}
          tickerSync={{
            lastSyncedAt: latestSec?.last_synced_at ?? null,
            secCount: secCount ?? 0,
          }}
          settingsDistribution={[...grouped.values()]}
          defaultUsers={Math.max(0, (userCount ?? 0) - (settingRows ?? []).length)}
        />
      </div>
    </div>
  );
}

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

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl">Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Control the hosted Gemini trial. Your own account is unlimited on the server key.
      </p>
      <div className="mt-8">
        <AdminControls hostedEnabled={settings?.hosted_ai_enabled ?? true} usage={usage} />
      </div>
    </div>
  );
}

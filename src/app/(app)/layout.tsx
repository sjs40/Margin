import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  let inboxCount = 0;
  if (data.user) {
    const { count } = await supabase
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .eq("status", "open");
    inboxCount = count ?? 0;
  }
  return (
    <AppShell inboxCount={inboxCount} email={data.user?.email} isAdmin={isAdminEmail(data.user?.email)}>
      {children}
    </AppShell>
  );
}

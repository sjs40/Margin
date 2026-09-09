import { SettingsForm } from "@/features/settings/settings-form";
import { createClient } from "@/lib/supabase/server";
import { getAiStatus } from "@/lib/ai-credentials";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const status = await getAiStatus(data.user.id, data.user.email);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your notes stay private to this account. AI processing uses your Gemini key when one is
        saved.
      </p>
      <div className="mt-8">
        <SettingsForm status={status} />
      </div>
    </div>
  );
}

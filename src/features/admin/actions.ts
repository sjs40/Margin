"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/env";

export async function setHostedAiEnabled(enabled: boolean) {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email)) return { error: "Unauthorized" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      hosted_ai_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

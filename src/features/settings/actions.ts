"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/secret-crypto";

export async function saveGeminiKey(rawKey: string) {
  const { user } = await requireUser();
  const key = rawKey.trim();
  if (!key) return { error: "Paste a Gemini API key." };
  let encrypted: string;
  try {
    encrypted = encryptSecret(key);
  } catch {
    return { error: "Server encryption is not configured." };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("user_ai_keys").upsert({
    user_id: user.id,
    gemini_api_key_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function removeGeminiKey() {
  const { user } = await requireUser();
  const supabase = createAdminClient();
  const { error } = await supabase.from("user_ai_keys").delete().eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

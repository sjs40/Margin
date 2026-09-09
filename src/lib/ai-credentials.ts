import { createAdminClient } from "@/lib/supabase/admin";
import { GeminiProvider } from "@/ai/providers/gemini";
import { getOptionalProvider, runWithProvider } from "@/ai/modelRouter";
import { aiConfig, isAdminEmail, isAiConfigured } from "@/lib/env";
import { aiSkipMessage, decideAiAccess, type AiSkipReason } from "@/lib/ai-access";
import { decryptSecret } from "@/lib/secret-crypto";
import { logger } from "@/lib/logger";

export type AiStatus = {
  hasUserKey: boolean;
  hostedEnabled: boolean;
  hostedConfigured: boolean;
  isAdmin: boolean;
  remaining: number;
  limit: number;
};

async function loadUserEmail(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

async function loadUserKey(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_ai_keys")
    .select("gemini_api_key_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.gemini_api_key_encrypted) return null;
  try {
    return decryptSecret(data.gemini_api_key_encrypted);
  } catch (error) {
    logger.error("user_ai_key_decrypt_failed", { userId });
    throw error;
  }
}

async function loadSettings() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("hosted_ai_enabled, hosted_ai_daily_limit")
    .eq("id", 1)
    .maybeSingle();
  return {
    hostedEnabled: data?.hosted_ai_enabled ?? true,
    limit: data?.hosted_ai_daily_limit ?? 5,
  };
}

async function usedToday(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_daily_usage")
    .select("action_count")
    .eq("user_id", userId)
    .eq("usage_date", new Date().toISOString().slice(0, 10))
    .maybeSingle();
  return data?.action_count ?? 0;
}

export async function getAiStatus(userId: string, email?: string | null): Promise<AiStatus> {
  const [{ hostedEnabled, limit }, used, keyRow, resolvedEmail] = await Promise.all([
    loadSettings(),
    usedToday(userId),
    createAdminClient()
      .from("user_ai_keys")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    email === undefined ? loadUserEmail(userId) : Promise.resolve(email),
  ]);
  return {
    hasUserKey: Boolean(keyRow.data?.user_id),
    hostedEnabled,
    hostedConfigured: isAiConfigured(),
    isAdmin: isAdminEmail(resolvedEmail),
    remaining: Math.max(0, limit - used),
    limit,
  };
}

export async function withUserAi<T>(
  userId: string,
  options: { consume: boolean; allowHosted?: boolean },
  fn: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; reason: AiSkipReason }> {
  const existing = getOptionalProvider();
  if (existing) return { ok: true, result: await fn() };

  const allowHosted = options.allowHosted ?? true;
  const [userKey, settings, used, email] = await Promise.all([
    loadUserKey(userId),
    loadSettings(),
    usedToday(userId),
    loadUserEmail(userId),
  ]);
  const decision = decideAiAccess({
    hasUserKey: Boolean(userKey),
    isAdmin: isAdminEmail(email),
    hostedEnabled: settings.hostedEnabled,
    hostedConfigured: isAiConfigured(),
    allowHosted,
    remaining: Math.max(0, settings.limit - used),
  });

  if (decision.use === "none") {
    logger.warn("ai_skipped", { userId, reason: decision.reason });
    return { ok: false, reason: decision.reason };
  }

  let apiKey = userKey;
  if (decision.use === "hosted") {
    if (decision.consume && options.consume) {
      const { data, error } = await createAdminClient().rpc("try_consume_hosted_action", {
        p_user_id: userId,
        p_limit: settings.limit,
      });
      if (error || data !== true) {
        logger.warn("ai_skipped", { userId, reason: "quota_exhausted" });
        return { ok: false, reason: "quota_exhausted" };
      }
    }
    apiKey = aiConfig.geminiApiKey;
  }

  if (!apiKey) return { ok: false, reason: "hosted_unconfigured" };
  const result = await runWithProvider(new GeminiProvider(apiKey), fn);
  return { ok: true, result };
}

export { aiSkipMessage };

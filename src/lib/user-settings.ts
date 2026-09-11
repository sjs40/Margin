import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_USER_SETTINGS = {
  contradictionMinConfidence: 0.7,
  contradictionPriorClaimsLimit: 50,
  contradictionDetectionEnabled: true,
};

export type UserSettings = typeof DEFAULT_USER_SETTINGS;

export function clampContradictionConfidence(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_USER_SETTINGS.contradictionMinConfidence;
  return Math.min(0.95, Math.max(0.5, value));
}

export function clampPriorClaimsLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_USER_SETTINGS.contradictionPriorClaimsLimit;
  return Math.min(200, Math.max(10, Math.round(value)));
}

export function settingsFromRow(row: {
  contradiction_min_confidence?: number | string | null;
  contradiction_prior_claims_limit?: number | null;
  contradiction_detection_enabled?: boolean | null;
} | null): UserSettings {
  if (!row) return { ...DEFAULT_USER_SETTINGS };
  return {
    contradictionMinConfidence: clampContradictionConfidence(
      Number(row.contradiction_min_confidence ?? DEFAULT_USER_SETTINGS.contradictionMinConfidence),
    ),
    contradictionPriorClaimsLimit: clampPriorClaimsLimit(
      row.contradiction_prior_claims_limit ?? DEFAULT_USER_SETTINGS.contradictionPriorClaimsLimit,
    ),
    contradictionDetectionEnabled: row.contradiction_detection_enabled ?? true,
  };
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_settings")
    .select(
      "contradiction_min_confidence, contradiction_prior_claims_limit, contradiction_detection_enabled",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return settingsFromRow(data);
}

export type AiDecision =
  | { use: "user" }
  | { use: "hosted"; consume: boolean }
  | {
      use: "none";
      reason:
        | "missing_user_key"
        | "hosted_disabled"
        | "quota_exhausted"
        | "own_key_required"
        | "hosted_unconfigured";
    };

export function decideAiAccess(input: {
  hasUserKey: boolean;
  isAdmin: boolean;
  hostedEnabled: boolean;
  hostedConfigured: boolean;
  allowHosted: boolean;
  remaining: number;
}): AiDecision {
  if (input.hasUserKey) return { use: "user" };
  if (input.isAdmin) {
    if (!input.hostedConfigured) return { use: "none", reason: "hosted_unconfigured" };
    return { use: "hosted", consume: false };
  }
  if (!input.allowHosted) return { use: "none", reason: "own_key_required" };
  if (!input.hostedEnabled) return { use: "none", reason: "hosted_disabled" };
  if (!input.hostedConfigured) return { use: "none", reason: "hosted_unconfigured" };
  if (input.remaining <= 0) return { use: "none", reason: "quota_exhausted" };
  return { use: "hosted", consume: true };
}

export type AiSkipReason = Extract<AiDecision, { use: "none" }>["reason"];

export function aiSkipMessage(reason: AiSkipReason): string {
  switch (reason) {
    case "quota_exhausted":
      return "Hosted AI allowance is used up for today. Add your own Gemini API key in Settings to keep processing.";
    case "hosted_disabled":
      return "Hosted AI is off. Add your own Gemini API key in Settings to process notes.";
    case "hosted_unconfigured":
      return "AI is not configured on this server. Add a Gemini API key in Settings.";
    case "own_key_required":
      return "This job needs your own Gemini API key. Add one in Settings.";
    case "missing_user_key":
      return "Add a Gemini API key in Settings to use AI.";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

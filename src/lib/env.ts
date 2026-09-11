function read(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function supabaseUrl(): string {
  // Direct property access so Next can inline NEXT_PUBLIC_ values in the browser bundle.
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function supabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

export function supabaseServiceRoleKey(): string {
  return read("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

export function isAiConfigured(): boolean {
  return Boolean(read("GEMINI_API_KEY"));
}

export function adminEmail(): string {
  return read("ADMIN_EMAIL").trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = adminEmail();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}

export function appUrl(): string {
  return read("APP_URL", "http://localhost:3000");
}

export const aiConfig = {
  fastModel: read("AI_FAST_MODEL", "gemini-3.7-flash"),
  visionModel: read("AI_VISION_MODEL", "gemini-3.7-flash"),
  synthesisModel: read("AI_SYNTHESIS_MODEL", "gemini-3.7-flash"),
  deepModel: read("AI_DEEP_MODEL", "gemini-3.7-flash"),
  embeddingModel: read("AI_EMBEDDING_MODEL", "gemini-embedding-2"),
  embeddingDimensions: Number(read("AI_EMBEDDING_DIMENSIONS", "1536")),
  geminiApiKey: read("GEMINI_API_KEY"),
  openRouterApiKey: read("OPENROUTER_API_KEY"),
};

export const retrievalLimits = {
  recentNotes: 20,
  semanticHistorical: 15,
};

export function secUserAgent(): string {
  return read("SEC_USER_AGENT").trim();
}

export function priceProvider(): "yahoo" | "stooq" | "none" {
  const value = read("PRICE_PROVIDER", "yahoo").trim().toLowerCase();
  if (value === "stooq" || value === "none") return value;
  return "yahoo";
}

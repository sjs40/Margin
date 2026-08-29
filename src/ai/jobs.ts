import { createAdminClient } from "@/lib/supabase/admin";
import { roundCost } from "@/lib/cost";

type JobInsert = {
  userId: string;
  jobType: string;
  objectType: string;
  objectId: string;
  provider: string;
  model?: string;
  promptVersion?: string;
};

export async function startJob(input: JobInsert) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_jobs")
    .insert({
      user_id: input.userId,
      job_type: input.jobType,
      object_type: input.objectType,
      object_id: input.objectId,
      provider: input.provider,
      model: input.model ?? null,
      prompt_version: input.promptVersion ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create AI job");
  return data.id as string;
}

export async function completeJob(
  id: string,
  input: {
    status: "completed" | "failed";
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: number;
    latencyMs?: number;
    errorMessage?: string;
    diagnostics?: Record<string, unknown>;
  },
) {
  const supabase = createAdminClient();
  await supabase
    .from("ai_jobs")
    .update({
      status: input.status,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      estimated_cost:
        input.estimatedCost != null ? roundCost(input.estimatedCost) : null,
      latency_ms: input.latencyMs ?? null,
      error_message: input.errorMessage ?? null,
      diagnostics: input.diagnostics ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

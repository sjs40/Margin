import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DiagnosticsPage() {
  if (process.env.NODE_ENV === "production") redirect("/");
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("ai_jobs")
    .select("id, job_type, model, prompt_version, status, latency_ms, input_tokens, output_tokens, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="font-serif text-3xl">AI diagnostics</h1>
      <p className="mt-2 text-sm text-muted-foreground">Development only. Operational metadata, not note contents.</p>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2">Job</th>
            <th>Model</th>
            <th>Prompt</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          {(jobs ?? []).map((job) => (
            <tr key={job.id} className="border-b border-border/70">
              <td className="py-2">{job.job_type}</td>
              <td>{job.model}</td>
              <td>{job.prompt_version}</td>
              <td>{job.status}</td>
              <td>{job.latency_ms}ms</td>
              <td>
                {job.input_tokens}/{job.output_tokens}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

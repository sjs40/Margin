import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InboxActions } from "@/features/inbox/inbox-actions";
import { formatLongDate } from "@/lib/dates";
import { findSimilarTheme } from "@/lib/theme-resolution";
import { asAliasList } from "@/lib/tickers";

type ClaimSnippet = {
  id?: string;
  text?: string;
  date?: string | null;
  noteId?: string | null;
};

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: items }, { data: themes }] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase.from("themes").select("id, name, aliases").eq("user_id", auth.user.id).eq("status", "active"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-3xl">Inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Only items that need a decision. Most notes never appear here.
      </p>
      <ul className="mt-6 divide-y divide-border">
        {(items ?? []).map((item) => {
          const payload = (item.payload ?? {}) as {
            priorClaim?: ClaimSnippet;
            newClaim?: ClaimSnippet;
            name?: string;
            similarThemeId?: string;
          };
          const similar =
            item.category === "suggested_theme"
              ? findSimilarTheme(String(payload.name ?? ""), (themes ?? []).map((theme) => ({
                  ...theme,
                  aliases: asAliasList(theme.aliases),
                })))
              : null;
          const body =
            item.category === "suggested_theme" && similar
              ? `Similar to existing theme: ${similar.name}`
              : item.body;
          return (
            <li key={item.id} className="py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {item.category.replace("_", " ")}
              </p>
              <p className="mt-1 font-medium">{item.title}</p>
              {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
              {item.category === "contradiction" ? (
                <div className="mt-3 space-y-2 rounded-lg border border-border p-3 text-sm">
                  <ClaimLine label="Prior" claim={payload.priorClaim} />
                  <ClaimLine label="New" claim={payload.newClaim} />
                </div>
              ) : null}
              <InboxActions
                item={{
                  ...item,
                  payload: { ...payload, similarThemeId: similar?.id ?? payload.similarThemeId },
                }}
                themes={(themes ?? []).map((theme) => ({ id: theme.id, name: theme.name }))}
              />
            </li>
          );
        })}
      </ul>
      {(items ?? []).length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Inbox is clear.</p>
      ) : null}
    </div>
  );
}

function ClaimLine({ label, claim }: { label: string; claim?: ClaimSnippet }) {
  if (!claim?.text) return null;
  return (
    <p>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {claim.date ? (
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          {formatLongDate(claim.date)}
        </span>
      ) : null}
      <span className="mt-1 block">{claim.text}</span>
      {claim.noteId ? (
        <Link href={`/notes/${claim.noteId}`} className="text-[11px] underline">
          Source note
        </Link>
      ) : null}
    </p>
  );
}
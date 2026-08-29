import { createClient } from "@/lib/supabase/server";
import { InboxActions } from "@/features/inbox/inbox-actions";

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: items } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-3xl">Inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Only items that need a decision. Most notes never appear here.
      </p>
      <ul className="mt-6 divide-y divide-border">
        {(items ?? []).map((item) => (
          <li key={item.id} className="py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {item.category.replace("_", " ")}
            </p>
            <p className="mt-1 font-medium">{item.title}</p>
            {item.body ? <p className="mt-1 text-sm text-muted-foreground">{item.body}</p> : null}
            <InboxActions item={item} />
          </li>
        ))}
      </ul>
      {(items ?? []).length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Inbox is clear.</p>
      ) : null}
    </div>
  );
}

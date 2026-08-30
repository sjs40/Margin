import { hostnameOf } from "@/lib/urls";
import type { NoteLink } from "@/types/domain";

export function SourceCards({ links }: { links: NoteLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="mt-6 space-y-3">
      {links.map((link) => (
        <li key={link.id}>
          <SourceCard link={link} />
        </li>
      ))}
    </ul>
  );
}

function SourceCard({ link }: { link: NoteLink }) {
  const href = link.canonical_url ?? link.url;
  const domain = hostnameOf(href);
  const title = link.title || domain;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 gap-3 rounded-lg border border-border bg-card p-3 hover:bg-secondary/40"
    >
      {link.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.image_url}
          alt=""
          className="hidden size-16 shrink-0 rounded-md object-cover sm:block"
        />
      ) : null}
      <span className="min-w-0">
        <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {domain}
          {link.fetch_status === "failed" ? " · link saved" : null}
        </span>
        <span className="mt-1 block font-sans text-sm font-medium leading-5">{title}</span>
        {link.description ? (
          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{link.description}</span>
        ) : null}
      </span>
    </a>
  );
}

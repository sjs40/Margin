"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatLongDate } from "@/lib/dates";
import { splitCitedAnswer } from "@/lib/ask-citations";

export type AskSource = {
  index: number;
  id: string;
  kind: string;
  title: string;
  date: string | null;
  snippet: string;
};

export function hrefFor(kind: string, id: string) {
  switch (kind) {
    case "note":
      return `/notes/${id}`;
    case "document":
      return `/documents/${id}`;
    case "company":
      return `/research/companies/${id}`;
    case "theme":
      return `/research/themes/${id}`;
    case "meta_note":
      return "/today";
    case "knowledge_object":
      return `/research/knowledge/${id}`;
    default:
      return "/research";
  }
}

function CitationChip({ source }: { source: AskSource }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={hrefFor(source.kind, source.id)}
          className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-muted px-1 align-super font-sans text-[11px] font-medium leading-none text-foreground no-underline hover:bg-muted/80"
        >
          {source.index}
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">
        <p className="font-medium">{source.title}</p>
        {source.date ? <p className="mt-1 opacity-80">{formatLongDate(source.date)}</p> : null}
        {source.snippet ? <p className="mt-1 opacity-80">{source.snippet}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function CitedAnswer({
  answer,
  sources,
}: {
  answer: string;
  sources: AskSource[];
}) {
  const byIndex = new Map(sources.map((source) => [source.index, source]));
  const segments = splitCitedAnswer(answer);
  const unsupported = sources.length === 0;

  return (
    <div>
      <div
        className={`font-serif text-[17px] leading-7 ${unsupported ? "text-muted-foreground" : "text-foreground"}`}
      >
        {segments.map((segment, offset) => {
          if (segment.type === "text") {
            return (
              <span key={offset} className="whitespace-pre-wrap">
                {segment.text}
              </span>
            );
          }
          const source = byIndex.get(segment.index);
          if (!source) return null;
          return <CitationChip key={offset} source={source} />;
        })}
      </div>
      {unsupported ? (
        <p className="mt-3 text-sm text-muted-foreground">No sources cited; treat as unsupported.</p>
      ) : null}
    </div>
  );
}

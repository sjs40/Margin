import { cashtagSegments } from "@/lib/tickers";
import { linkifyParts } from "@/lib/urls";
import Link from "next/link";

export type CompanyLink = { id: string; ticker: string | null };

export function LinkifiedText({
  text,
  companies = [],
}: {
  text: string;
  companies?: CompanyLink[];
}) {
  const hrefForTicker = (ticker: string) => {
    const match = companies.find((company) => company.ticker?.toUpperCase() === ticker);
    return match ? `/research/companies/${match.id}` : undefined;
  };

  return (
    <p className="mt-2 whitespace-pre-wrap font-serif text-[17px] leading-7">
      {linkifyParts(text).flatMap((part, index) => {
        if (part.type === "url") {
          return [
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {part.display}
            </a>,
          ];
        }
        return cashtagSegments(part.value, hrefForTicker).map((segment, inner) => {
          if (segment.type === "cashtag" && segment.href) {
            return (
              <Link key={`${index}-${inner}-${segment.value}`} href={segment.href} className="underline underline-offset-2">
                {segment.value}
              </Link>
            );
          }
          return <span key={`${index}-${inner}`}>{segment.value}</span>;
        });
      })}
    </p>
  );
}

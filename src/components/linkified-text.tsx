import { linkifyParts } from "@/lib/urls";

export function LinkifiedText({ text }: { text: string }) {
  return (
    <p className="mt-2 whitespace-pre-wrap font-serif text-[17px] leading-7">
      {linkifyParts(text).map((part, index) => {
        if (part.type === "url") {
          return (
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {part.display}
            </a>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </p>
  );
}

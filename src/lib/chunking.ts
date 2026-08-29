export type Chunk = {
  index: number;
  content: string;
  heading: string | null;
};

const TARGET_CHARS = 2800;

export function chunkDocument(markdown: string): Chunk[] {
  const blocks = splitByHeadings(markdown);
  const chunks: Chunk[] = [];
  let buffer = "";
  let heading: string | null = null;

  const push = () => {
    const content = buffer.trim();
    if (!content) return;
    chunks.push({ index: chunks.length, content, heading });
    buffer = "";
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      if (buffer.length > 0) push();
      heading = block.text;
      buffer = block.raw;
      continue;
    }
    if ((buffer + "\n\n" + block.raw).length > TARGET_CHARS && buffer.length > 0) {
      push();
    }
    buffer = `${buffer}\n\n${block.raw}`.trim();
  }
  push();
  return chunks.length > 0 ? chunks : [{ index: 0, content: markdown, heading: null }];
}

function splitByHeadings(markdown: string): Array<
  | { type: "heading"; text: string; raw: string }
  | { type: "body"; raw: string }
> {
  const parts = markdown.split(/(?=^#{1,3}\s+.+$)/m);
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const heading = part.match(/^(#{1,3})\s+(.+)$/m);
      if (heading && part.startsWith(heading[0])) {
        return { type: "heading" as const, text: heading[2].trim(), raw: part };
      }
      return { type: "body" as const, raw: part };
    });
}

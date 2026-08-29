import matter from "gray-matter";

export type ImportedDocument = {
  title: string;
  documentType: "ai_research_session" | "research_session" | "longform";
  source: string | null;
  date: string | null;
  companies: string[];
  themes: string[];
  sections: Record<string, string>;
  raw: string;
};

const SECTION_ALIASES: Record<string, string> = {
  "executive synthesis": "executiveSynthesis",
  "current view": "currentView",
  "what changed in my thinking": "whatChanged",
  "key learnings": "learnings",
  insights: "insights",
  "mental models": "mentalModels",
  "useful framings": "framings",
  "evidence and observations": "evidence",
  counterarguments: "counterarguments",
  "open questions": "questions",
  "follow-ups": "followUps",
  followups: "followUps",
  "potential investment implications": "implications",
};

export function parseImportedMarkdown(raw: string): ImportedDocument {
  const parsed = matter(raw);
  const data = isRecord(parsed.data) ? parsed.data : {};
  const body = parsed.content.trim();
  const sections = extractSections(body);
  const frontmatterCompanies = stringList(data.companies);
  const frontmatterThemes = stringList(data.themes);
  const title =
    stringValue(data.title) ||
    firstHeading(body) ||
    "Imported research note";

  const typeValue = stringValue(data.type);
  const documentType =
    typeValue === "ai_research_session" ||
    typeValue === "research_session" ||
    typeValue === "longform"
      ? typeValue
      : body.length > 1200
        ? "research_session"
        : "longform";

  return {
    title,
    documentType,
    source: stringValue(data.source),
    date: stringValue(data.date),
    companies: unique(frontmatterCompanies),
    themes: unique(frontmatterThemes),
    sections,
    raw,
  };
}

function extractSections(markdown: string): Record<string, string> {
  const lines = markdown.split(/\r?\n/);
  const sections: Record<string, string> = {};
  let current: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!current) return;
    sections[current] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flush();
      const rawHeading = heading[1].trim().toLowerCase();
      current = SECTION_ALIASES[rawHeading] ?? rawHeading.replace(/\s+/g, "_");
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

function firstHeading(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export type ExportEntity = { ticker: string | null; name: string };
export type ExportTheme = { name: string };
export type ExportClaim = {
  claim_text: string;
  claim_type: string;
  status?: string | null;
  confidence?: number | null;
  created_at?: string | null;
};
export type ExportQuestion = {
  question_text: string;
  status: string;
  resolution_comment?: string | null;
};
export type ExportFollowup = {
  text: string;
  status: string;
  resolution_comment?: string | null;
};
export type ExportAnnotation = {
  id: string;
  text: string;
  parent_annotation_id: string | null;
  created_at: string;
};
export type ExportLink = { url: string; title: string | null };
export type ExportPriceStamp = {
  ticker: string | null;
  price: number | null;
  currency: string | null;
};

export type ExportNote = {
  id: string;
  captured_at: string;
  source_type: string;
  title: string | null;
  raw_text: string | null;
  interpreted_text: string | null;
};

export type NoteExportExtras = {
  entities?: ExportEntity[];
  themes?: ExportTheme[];
  claims?: ExportClaim[];
  questions?: ExportQuestion[];
  followups?: ExportFollowup[];
  annotations?: ExportAnnotation[];
  links?: ExportLink[];
  prices?: ExportPriceStamp[];
};

export type CompanyExportInput = {
  ticker: string | null;
  canonical_name: string;
  metaNote?: string | null;
  versions?: Array<{ version_number: number; change_summary: string | null }>;
  claims?: ExportClaim[];
  questions?: ExportQuestion[];
  followups?: ExportFollowup[];
  notes?: Array<{ note: ExportNote; extras?: NoteExportExtras }>;
};

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "note";
}

export function noteFilename(note: ExportNote): string {
  const date = note.captured_at.slice(0, 10);
  return `${date}-${slugify(note.title || note.id)}.md`;
}

function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9._:-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function yamlList(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[${items.map(yamlScalar).join(", ")}]`;
}

function annotationTree(annotations: ExportAnnotation[]): string {
  const roots = annotations.filter((item) => !item.parent_annotation_id);
  const children = (id: string) => annotations.filter((item) => item.parent_annotation_id === id);
  const lines: string[] = [];
  for (const root of roots) {
    lines.push(`- ${root.text}`);
    for (const child of children(root.id)) {
      lines.push(`  - ${child.text}`);
    }
  }
  return lines.join("\n");
}

export function noteToMarkdown(note: ExportNote, extras: NoteExportExtras = {}): string {
  const tickers = (extras.entities ?? []).map((entity) => entity.ticker).filter((ticker): ticker is string => Boolean(ticker));
  const themes = (extras.themes ?? []).map((theme) => theme.name);
  const prices = extras.prices ?? [];
  const original = note.raw_text ?? "";
  const interpreted = note.interpreted_text ?? "";
  const lines = [
    "---",
    `id: ${note.id}`,
    `captured_at: ${note.captured_at}`,
    `source_type: ${note.source_type}`,
    `tickers: ${yamlList(tickers)}`,
    `themes: ${yamlList(themes)}`,
    "price_stamps:",
  ];
  if (prices.length === 0) {
    lines.push("  []");
  } else {
    for (const stamp of prices) {
      if (stamp.ticker && stamp.price != null) {
        lines.push(`  - ticker: ${stamp.ticker}`);
        lines.push(`    price: ${stamp.price}`);
        lines.push(`    currency: ${stamp.currency ?? "USD"}`);
      }
    }
  }
  lines.push("---", "", original.trim() || "_Empty note._", "");
  if (interpreted && interpreted.trim() !== original.trim()) {
    lines.push("## Interpreted", "", interpreted.trim(), "");
  }
  if ((extras.claims ?? []).length) {
    lines.push("## Claims", "");
    for (const claim of extras.claims ?? []) {
      lines.push(`- (${claim.claim_type}${claim.status ? `, ${claim.status}` : ""}) ${claim.claim_text}`);
    }
    lines.push("");
  }
  if ((extras.questions ?? []).length) {
    lines.push("## Questions", "");
    for (const question of extras.questions ?? []) {
      const resolution = question.resolution_comment ? ` → ${question.resolution_comment}` : "";
      lines.push(`- [${question.status}] ${question.question_text}${resolution}`);
    }
    lines.push("");
  }
  if ((extras.followups ?? []).length) {
    lines.push("## Follow-ups", "");
    for (const followup of extras.followups ?? []) {
      const resolution = followup.resolution_comment ? ` → ${followup.resolution_comment}` : "";
      lines.push(`- [${followup.status}] ${followup.text}${resolution}`);
    }
    lines.push("");
  }
  if ((extras.annotations ?? []).length) {
    lines.push("## Annotations", "", annotationTree(extras.annotations ?? []), "");
  }
  if ((extras.links ?? []).length) {
    lines.push("## Links", "");
    for (const link of extras.links ?? []) {
      const label = link.title || link.url;
      lines.push(`- [${label}](${link.url})`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

const CLAIM_ORDER = [
  "thesis",
  "inference",
  "observation",
  "fact",
  "management_claim",
  "external_claim",
  "risk",
  "counterargument",
];

export function companyToMarkdown(
  entity: { ticker: string | null; canonical_name: string },
  extras: Omit<CompanyExportInput, "ticker" | "canonical_name">,
): string {
  const heading = entity.ticker
    ? `# ${entity.ticker} · ${entity.canonical_name}`
    : `# ${entity.canonical_name}`;
  const parts = [heading, ""];
  if (extras.metaNote) {
    parts.push("## Memory", "", extras.metaNote.trim(), "");
  }
  const claims = extras.claims ?? [];
  if (claims.length) {
    parts.push("## Claims", "");
    for (const type of CLAIM_ORDER) {
      const group = claims.filter((claim) => claim.claim_type === type);
      if (!group.length) continue;
      parts.push(`### ${type}`, "");
      for (const claim of group) {
        const date = claim.created_at ? ` (${claim.created_at.slice(0, 10)})` : "";
        parts.push(`- [${claim.status ?? "active"}] ${claim.claim_text}${date}`);
      }
      parts.push("");
    }
  }
  const questions = extras.questions ?? [];
  const openQ = questions.filter((item) => item.status === "open");
  const resolvedQ = questions.filter((item) => item.status !== "open");
  if (questions.length) {
    parts.push("## Questions", "");
    if (openQ.length) {
      parts.push("### Open", "");
      for (const item of openQ) parts.push(`- ${item.question_text}`);
      parts.push("");
    }
    if (resolvedQ.length) {
      parts.push("### Resolved", "");
      for (const item of resolvedQ) {
        parts.push(`- ${item.question_text}${item.resolution_comment ? ` → ${item.resolution_comment}` : ""}`);
      }
      parts.push("");
    }
  }
  const notes = extras.notes ?? [];
  if (notes.length) {
    parts.push("## Notes", "");
    const chronological = [...notes].sort(
      (a, b) => new Date(a.note.captured_at).getTime() - new Date(b.note.captured_at).getTime(),
    );
    for (const entry of chronological) {
      const stamp = (entry.extras?.prices ?? []).find((price) => price.price != null && price.ticker);
      const stampLine = stamp?.ticker
        ? `Price at capture: ${stamp.ticker} $${Number(stamp.price).toFixed(2)}`
        : "";
      parts.push(`### ${entry.note.captured_at.slice(0, 10)} · ${entry.note.title || "Note"}`, "");
      if (stampLine) parts.push(stampLine, "");
      parts.push(`[Open note](./notes/${noteFilename(entry.note)})`, "");
      parts.push(noteToMarkdown(entry.note, entry.extras), "");
    }
  }
  return `${parts.join("\n").trim()}\n`;
}

export function themeToMarkdown(
  theme: { name: string },
  extras: { metaNote?: string | null; notes?: Array<{ note: ExportNote; extras?: NoteExportExtras }> },
): string {
  const parts = [`# ${theme.name}`, ""];
  if (extras.metaNote) parts.push("## Memory", "", extras.metaNote.trim(), "");
  const notes = extras.notes ?? [];
  if (notes.length) {
    parts.push("## Notes", "");
    for (const entry of notes) {
      parts.push(`### ${entry.note.captured_at.slice(0, 10)} · ${entry.note.title || "Note"}`, "");
      parts.push(`[Open note](./notes/${noteFilename(entry.note)})`, "");
      parts.push(noteToMarkdown(entry.note, entry.extras), "");
    }
  }
  return `${parts.join("\n").trim()}\n`;
}

export function indexMarkdown(notes: ExportNote[]): string {
  const lines = ["# Margin export", "", "Relative note files:", ""];
  for (const note of notes) {
    const title = note.title || note.id;
    lines.push(`- [${title}](./notes/${noteFilename(note)})`);
  }
  return `${lines.join("\n")}\n`;
}

export function noteExportFiles(
  notes: Array<{ note: ExportNote; extras?: NoteExportExtras }>,
): Record<string, string> {
  const files: Record<string, string> = {
    "index.md": indexMarkdown(notes.map((entry) => entry.note)),
  };
  for (const entry of notes) {
    files[`notes/${noteFilename(entry.note)}`] = noteToMarkdown(entry.note, entry.extras);
  }
  return files;
}

export const ANALYST_PREAMBLE = `You are processing private investment-research notes for a single public-equity analyst.
Rules:
- Preserve uncertainty. Do not convert speculation into fact.
- Distinguish user observations from factual claims.
- Do not invent ticker mappings. If a ticker is ambiguous, lower confidence.
- Do not add outside financial knowledge unless it is explicitly present in the source.
- Prioritize durable insights over conversational summary.
- Preserve counterarguments and unresolved questions.
- Avoid false precision.
- Return schema-compliant JSON only.`;

export const PARSE_NOTE_PROMPT_VERSION = "parse-note-v3";

export type AttachedSource = {
  url: string;
  title: string | null;
  description: string | null;
};

function attachedSourcesBlock(sources: AttachedSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map((source) => {
    const title = source.title ? `\n  title: ${source.title}` : "";
    const excerpt = source.description ? `\n  excerpt: ${source.description}` : "";
    return `- ${source.url}${title}${excerpt}`;
  });
  return `Attached sources (URLs the user included; metadata is a page title/excerpt only, not the article body):
${lines.join("\n")}

Treat the source note as the user's comments and take. Use attached metadata only as context. Do not invent article body, quotes, or facts that are not in the note or the excerpt. Keep URLs as markdown links in cleanedText.

`;
}

export function parseNotePrompt(
  rawText: string,
  existingThemes: string[],
  attachedSources: AttachedSource[] = [],
  taggedTickers: string[] = [],
): string {
  return `${ANALYST_PREAMBLE}

Task: parse this captured research fragment.

Do not over-interpret extremely short notes. A ticker list is a reminder, not a thesis.
If there is no reliable claim, return an empty claims array.

Existing themes the user already tracks (prefer linking rather than inventing synonyms):
${existingThemes.length ? existingThemes.map((theme) => `- ${theme}`).join("\n") : "- none yet"}

User-tagged tickers:
${taggedTickers.length ? taggedTickers.map((ticker) => `- $${ticker}`).join("\n") : "- none"}
Do not second-guess these cashtags. Include them in companies with high confidence.

${attachedSourcesBlock(attachedSources)}Source note:
"""
${rawText}
"""`;
}

export const HANDWRITING_PROMPT_VERSION = "interpret-handwriting-v1";

export function handwritingPrompt(): string {
  return `${ANALYST_PREAMBLE}

Transcribe this handwritten investment-research page.
Return:
- literalTranscription: best-effort of what the page actually says, including shorthand.
- interpretedText: cleaned meaning without inventing a thesis.
- uncertainSegments: anything you cannot read confidently.
- possibleTickers: only when capitalization/context supports a ticker.
Interpret investment shorthand conservatively. Example: "CART incr marg >> GMV" means incremental margins may matter more than GMV, not a full company model.`;
}

export const PARSE_IMPORT_PROMPT_VERSION = "parse-ai-import-v1";

export function parseImportPrompt(raw: string, existingThemes: string[]): string {
  return `${ANALYST_PREAMBLE}

Distill this pasted research document. Do not summarize conversational sequence or filler.
Preserve useful intellectual output: topics, companies, themes, learnings, insights, mental models, framings, evidence, counterarguments, questions, follow-ups, and investment implications.

Existing themes:
${existingThemes.length ? existingThemes.map((theme) => `- ${theme}`).join("\n") : "- none yet"}

Document:
"""
${raw}
"""`;
}

export const DAILY_SYNTHESIS_PROMPT_VERSION = "daily-synthesis-v3";

export function dailySynthesisPrompt(input: {
  date: string;
  notes: string;
  existingDaily?: string | null;
  userEdited?: boolean;
  resolvedQuestions?: string;
}): string {
  return `${ANALYST_PREAMBLE}

Write a Daily Meta Note for ${input.date}.
Answer: what from today's research is worth remembering later?
Group related notes. Identify learnings, view changes, contradictions, open questions, and useful connections.
Do not manufacture content to fill sections. Omit empty sections.
Do not write a chronological "first you discussed..." recap.
If an existing daily note is provided, update it rather than wiping user wording.
${input.userEdited ? "The user has edited this page. Preserve established statements unless new evidence changes them." : ""}

Existing daily note:
"""
${input.existingDaily ?? "(none)"}
"""

Resolved questions:
"""
${input.resolvedQuestions ?? "(none)"}
"""

Today's source material:
"""
${input.notes}
"""`;
}

export const COMPANY_MEMORY_PROMPT_VERSION = "company-memory-v3";

export function companyMemoryPrompt(input: {
  name: string;
  ticker: string | null;
  existing: string | null;
  userEdited: boolean;
  recent: string;
  priorClaims?: string;
  resolvedQuestions?: string;
}): string {
  return `${ANALYST_PREAMBLE}

Update the living Company Meta Note for ${input.name}${input.ticker ? ` (${input.ticker})` : ""}.
Capture the user's thinking, not a generic company profile.
Never manufacture a thesis. "Early research / insufficient evidence for a thesis" is acceptable.
${input.userEdited ? "The user has edited this page. Preserve established statements unless new evidence changes them." : ""}
If prior active claims are provided, reflect changed or still-open views rather than restating every claim.

Existing meta note:
"""
${input.existing ?? "(none)"}
"""

Prior active claims:
"""
${input.priorClaims ?? "(none)"}
"""

Resolved questions:
"""
${input.resolvedQuestions ?? "(none)"}
"""

New and relevant notes:
"""
${input.recent}
"""`;
}

export const CLAIM_CONFLICTS_PROMPT_VERSION = "claim-conflicts-v1";

export function claimConflictsPrompt(input: {
  ticker: string | null;
  name: string;
  newClaims: string;
  priorClaims: string;
}): string {
  return `${ANALYST_PREAMBLE}

Task: detect genuine tension in the user's own stated view for ${input.name}${input.ticker ? ` (${input.ticker})` : ""}.

Compare the new claims to prior active claims.
Flag only real tension in the same view — not different topics, not different time horizons, and not a new fact that merely adds detail.
Prefer "supersedes" when the new claim is an update of the same view with new evidence.
Use "contradicts" when the new claim rejects a prior view.
Use "supports" only when the new claim clearly reinforces a prior claim.
If nothing qualifies, return an empty conflicts array.
Use the provided claim ids exactly. Do not invent ids.

New claims:
"""
${input.newClaims}
"""

Prior active claims:
"""
${input.priorClaims}
"""`;
}

export const THEME_MEMORY_PROMPT_VERSION = "theme-memory-v1";

export function themeMemoryPrompt(input: {
  name: string;
  existing: string | null;
  userEdited: boolean;
  recent: string;
}): string {
  return `${ANALYST_PREAMBLE}

Update the Theme Meta Note for "${input.name}".
Capture the core idea, mechanism, why it matters, exposed companies, supporting observations, contradictions, implications, open questions, and evolution.
Do not force a stock recommendation.
${input.userEdited ? "Preserve user-authored statements unless evidence changes them." : ""}

Existing meta note:
"""
${input.existing ?? "(none)"}
"""

New and relevant notes:
"""
${input.recent}
"""`;
}

export const DISCOVER_CONNECTIONS_PROMPT_VERSION = "discover-connections-v1";

export function discoverConnectionsPrompt(input: {
  notes: string;
  existingThemes: string[];
}): string {
  return `${ANALYST_PREAMBLE}

Analyze recent notes for latent patterns: recurring concepts, similar observations across companies, repeated unanswered questions, unnamed themes, and connections between existing themes.
Do not auto-create a theme unless confidence is very high (autoCreate=true only then).
Otherwise suggest it for user approval.

Existing themes:
${input.existingThemes.map((theme) => `- ${theme}`).join("\n") || "- none"}

Recent notes:
"""
${input.notes}
"""`;
}

export const ASK_PROMPT_VERSION = "answer-from-memory-v1";

export function askFromMemoryPrompt(input: {
  question: string;
  context: string;
}): string {
  return `${ANALYST_PREAMBLE}

Answer using only the analyst's own notes below. If the notes do not support an answer, say so.
Distinguish synthesis from source material. Do not use world knowledge.
Cite sources by the provided ids. Never fabricate references.

Question:
${input.question}

Retrieved memory:
"""
${input.context}
"""`;
}

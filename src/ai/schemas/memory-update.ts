import { z } from "zod";

export const MemoryUpdateSchema = z.object({
  title: z.string(),
  content: z.string(),
  changeSummary: z.string(),
  viewChanged: z.boolean(),
  affectedTickers: z.array(z.string()),
  affectedThemes: z.array(z.string()),
});

export type MemoryUpdate = z.infer<typeof MemoryUpdateSchema>;

export const DailySynthesisSchema = z.object({
  title: z.string(),
  content: z.string(),
  changeSummary: z.string(),
  affectedTickers: z.array(z.string()),
  affectedThemes: z.array(z.string()),
});

export type DailySynthesis = z.infer<typeof DailySynthesisSchema>;

export const ConnectionDiscoverySchema = z.object({
  emergingThemes: z.array(
    z.object({
      name: z.string(),
      rationale: z.string(),
      relatedTickers: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      autoCreate: z.boolean(),
    }),
  ),
  looseEnds: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      kind: z.enum([
        "repeated_question",
        "unfinished_followup",
        "undeveloped_company",
        "stale_theme",
        "contradiction",
      ]),
    }),
  ),
  connections: z.array(z.string()),
});

export type ConnectionDiscovery = z.infer<typeof ConnectionDiscoverySchema>;

export const AskAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["note", "document", "meta_note"]),
      title: z.string(),
      date: z.string().nullable(),
    }),
  ),
});

export type AskAnswer = z.infer<typeof AskAnswerSchema>;

export const ParsedImportSchema = z.object({
  title: z.string(),
  documentType: z.enum(["ai_research_session", "research_session", "longform"]),
  cleanedMarkdown: z.string(),
  companies: z.array(
    z.object({
      name: z.string().nullable(),
      ticker: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  themes: z.array(
    z.object({
      name: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  claims: z.array(
    z.object({
      text: z.string(),
      type: z.enum([
        "fact",
        "management_claim",
        "external_claim",
        "observation",
        "inference",
        "thesis",
        "risk",
        "counterargument",
      ]),
      confidence: z.number().min(0).max(1),
    }),
  ),
  questions: z.array(z.string()),
  followUps: z.array(z.string()),
  overallConfidence: z.number().min(0).max(1),
});

export type ParsedImport = z.infer<typeof ParsedImportSchema>;

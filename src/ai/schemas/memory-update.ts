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
      sourceNoteIds: z.array(z.string()).default([]),
      sourceDocumentIds: z.array(z.string()).default([]),
    }),
  ),
  connections: z.array(
    z.object({
      fromTitle: z.string(),
      fromNoteId: z.string().nullable(),
      toTitle: z.string(),
      toNoteId: z.string().nullable(),
      relationType: z.enum([
        "instance_of",
        "supports",
        "contradicts",
        "extends",
        "refines",
        "same_mechanism",
        "boundary_condition",
        "related",
      ]),
      explanation: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  candidateInsights: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        rationale: z.string(),
        relatedTickers: z.array(z.string()),
        relatedThemes: z.array(z.string()),
        confidence: z.number().min(0).max(1),
        sourceNoteIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  candidateFrameworks: z
    .array(
      z.object({
        title: z.string(),
        formulation: z.string(),
        mechanism: z.string(),
        boundaryConditions: z.array(z.string()),
        confidence: z.number().min(0).max(1),
        sourceNoteIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export type ConnectionDiscovery = z.infer<typeof ConnectionDiscoverySchema>;

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
  candidateInsights: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        rationale: z.string(),
        relatedTickers: z.array(z.string()),
        relatedThemes: z.array(z.string()),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),
  candidateFrameworks: z
    .array(
      z.object({
        title: z.string(),
        formulation: z.string(),
        mechanism: z.string(),
        boundaryConditions: z.array(z.string()),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),
});

export type ParsedImport = z.infer<typeof ParsedImportSchema>;

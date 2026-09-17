import { z } from "zod";

export const ParsedNoteSchema = z.object({
  cleanedText: z.string(),
  title: z.string(),
  noteKind: z.enum([
    "quick",
    "research",
    "thinking",
    "question",
    "observation",
    "mixed",
  ]),
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
  importance: z.number().min(0).max(1),
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

export type ParsedNote = z.infer<typeof ParsedNoteSchema>;

import { z } from "zod";

export const CandidateInsightSchema = z.object({
  title: z.string(),
  summary: z.string(),
  rationale: z.string(),
  relatedTickers: z.array(z.string()),
  relatedThemes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const CandidateFrameworkSchema = z.object({
  title: z.string(),
  formulation: z.string(),
  mechanism: z.string(),
  boundaryConditions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const KnowledgeCandidatesSchema = z.object({
  candidateInsights: z.array(CandidateInsightSchema).default([]),
  candidateFrameworks: z.array(CandidateFrameworkSchema).default([]),
});

export const KnowledgeDispositionSchema = z.object({
  decision: z.enum(["new", "possible_duplicate", "possible_update", "possible_evidence"]),
  existingObjectId: z.string().nullable(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});

export type CandidateInsight = z.infer<typeof CandidateInsightSchema>;
export type CandidateFramework = z.infer<typeof CandidateFrameworkSchema>;
export type KnowledgeDispositionResult = z.infer<typeof KnowledgeDispositionSchema>;

import { z } from "zod";

export const ClaimConflictsSchema = z.object({
  conflicts: z.array(
    z.object({
      newClaimId: z.string(),
      priorClaimId: z.string(),
      relation: z.enum(["contradicts", "supersedes", "supports"]),
      explanation: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type ClaimConflicts = z.infer<typeof ClaimConflictsSchema>;

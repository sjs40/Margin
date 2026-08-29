import { z } from "zod";

export const HandwritingSchema = z.object({
  literalTranscription: z.string(),
  interpretedText: z.string(),
  uncertainSegments: z.array(
    z.object({
      text: z.string(),
      reason: z.string(),
    }),
  ),
  possibleTickers: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type HandwritingResult = z.infer<typeof HandwritingSchema>;

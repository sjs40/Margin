import { z } from "zod";

export const AskAnswerSchema = z.object({
  answer: z.string(),
  citedIndices: z.array(z.number().int().positive()),
});

export type AskAnswer = z.infer<typeof AskAnswerSchema>;

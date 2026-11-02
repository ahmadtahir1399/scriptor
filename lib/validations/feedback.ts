import { z } from "zod";

import { uuidSchema } from "@/lib/validations/paper";

/**
 * Helpfulness feedback input.
 *
 * This is the eval signal the whole prompt-improvement loop (P15/P16) depends
 * on, so it is captured from day one and validated at the boundary. `isHelpful`
 * null clears a prior rating; a comment is only meaningful on a thumbs-down and
 * is capped so a runaway paste cannot bloat the row.
 */
export const helpfulnessSchema = z.object({
  checkResultId: uuidSchema,
  isHelpful: z.boolean().nullable(),
  comment: z.string().trim().max(1000).nullable().default(null),
});
export type HelpfulnessInput = z.infer<typeof helpfulnessSchema>;

export const retryCheckSchema = z.object({
  checkResultId: uuidSchema,
});
export type RetryCheckInput = z.infer<typeof retryCheckSchema>;

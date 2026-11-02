import { z } from "zod";

import { uuidSchema } from "@/lib/validations/paper";

/** Server-action input + model-output schemas for the to-do list. */

export const toggleTodoSchema = z.object({
  itemId: uuidSchema,
  done: z.boolean(),
});
export type ToggleTodoInput = z.infer<typeof toggleTodoSchema>;

export const addTodoSchema = z.object({
  analysisId: uuidSchema,
  title: z.string().trim().min(1, "must not be empty").max(300),
  description: z.string().trim().max(1000).default(""),
  estimateMinutes: z.number().int().min(0).max(480).nullable().default(null),
});
export type AddTodoInput = z.infer<typeof addTodoSchema>;

export const updateTodoSchema = z.object({
  itemId: uuidSchema,
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(1000).optional(),
  estimateMinutes: z.number().int().min(0).max(480).nullable().optional(),
});
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

export const deleteTodoSchema = z.object({
  itemId: uuidSchema,
});
export type DeleteTodoInput = z.infer<typeof deleteTodoSchema>;

export const reorderTodoSchema = z.object({
  groupId: uuidSchema,
  itemIds: z.array(uuidSchema).max(200),
});
export type ReorderTodoInput = z.infer<typeof reorderTodoSchema>;

export const setDeadlineSchema = z.object({
  analysisId: uuidSchema,
  /** ISO date-time, or null to clear the deadline. */
  deadline: z.string().datetime().nullable(),
});
export type SetDeadlineInput = z.infer<typeof setDeadlineSchema>;

export const generatePlanSchema = z.object({
  analysisId: uuidSchema,
});
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

/**
 * The plan shape the generation model must return.
 *
 * `refs` traces each task back to the signals it addresses — a task with no ref
 * is invented work and is dropped, so this array is required (may be empty only
 * for a summary task the caller then discards).
 */
export const llmTodoItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(1000).default(""),
  effort: z.string().trim().max(40).default("30m"),
  refs: z.array(z.string().trim().min(1).max(64)).default([]),
});
export type LlmTodoItem = z.infer<typeof llmTodoItemSchema>;

export const llmTodoGroupSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).default(""),
  items: z.array(llmTodoItemSchema).default([]),
});
export type LlmTodoGroup = z.infer<typeof llmTodoGroupSchema>;

export const llmTodoPlanSchema = z.object({
  groups: z.array(llmTodoGroupSchema).default([]),
});
export type LlmTodoPlan = z.infer<typeof llmTodoPlanSchema>;

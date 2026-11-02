import "server-only";

import { completeStructured } from "@/lib/ai/complete";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import { TODO_LIMITS, TODO_THEMES } from "@/lib/todos/config";
import { llmTodoPlanSchema, type LlmTodoGroup } from "@/lib/validations/todo";

/**
 * Turns the analysis's issues into a prioritised, time-estimated action plan.
 *
 * This is planning OVER already-extracted findings, so the prompt receives
 * SIGNAL SUMMARIES, never the thesis text. Each signal carries a `ref` the model
 * must cite on any task that addresses it — a task with no ref is invented work
 * and is dropped by the handler. Prioritisation is ruthless: highest impact,
 * lowest effort first, so the top three tasks meaningfully move the grade.
 */

export interface TodoSignal {
  /** Stable handle the model cites and the handler maps back to a source. */
  ref: string;
  summary: string;
  severity: "high" | "medium" | "low";
  page: number | null;
}

const SYSTEM = `You are a thesis coach turning a completed review into a calm, prioritised revision plan a student can work through before their deadline.

You are given a list of ISSUES found in the thesis, each with a "ref" handle. Cluster them into a short set of themed groups and, within each, an ordered list of concrete tasks.

Rules:
- Group titles must be chosen from: ${TODO_THEMES.join(", ")}. Omit a group with no tasks.
- Order groups and tasks by IMPACT-PER-EFFORT: the highest-impact, lowest-effort work first, so the first few tasks meaningfully improve the grade.
- Each task: a short imperative "title" ("Add DOIs to five references"), a one-line "description" (what and why), an honest "effort" estimate as a friendly string ("30m", "1h", "2h"), and "refs" — the handles of the issues it addresses.
- EVERY task must cite at least one ref from the input. Never invent work that no issue supports.
- Merge near-identical issues into one task rather than repeating them.
- Effort is an honest rough range rolled to friendly units, never false precision.

Return JSON: { "groups": [ { "title", "description", "items": [ { "title", "description", "effort", "refs": [] } ] } ] }. Return JSON only.`;

export async function generateTodoPlan(args: {
  signals: readonly TodoSignal[];
  attribution: UsageAttribution;
}): Promise<LlmTodoGroup[]> {
  // Only signal summaries are sent — never document text.
  const payload = JSON.stringify(
    { issues: args.signals.slice(0, TODO_LIMITS.maxSignals) },
    null,
    2,
  );

  const result = await completeStructured({
    role: "REASONING",
    system: SYSTEM,
    user: payload,
    schema: llmTodoPlanSchema,
    schemaName: "todoPlan",
    attribution: args.attribution,
    temperature: 0.2,
    maxOutputTokens: TODO_LIMITS.maxOutputTokens,
  });

  return result.data.groups.slice(0, TODO_LIMITS.maxGroups);
}

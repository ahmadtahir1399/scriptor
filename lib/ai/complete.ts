// SERVER ONLY — the single entry point for every model call in the app.
import "server-only";

import type { z } from "zod";

import { getOpenAIClient } from "@/lib/ai/client";
import {
  resolveModel,
  resolveModelRole,
  type ModelRole,
} from "@/lib/ai/models";
import { logTokenUsage, type UsageAttribution } from "@/lib/ai/tokenUsage";

/**
 * Every model call in Scriptor goes through this function.
 *
 * That is not a style preference. `complete()` is the only place that writes a
 * `token_usage` row, so a call made anywhere else spends money that never
 * appears in the cost dashboards. If you find yourself importing the OpenAI
 * SDK at a call site, stop — add a capability here instead.
 *
 * P5 extends this with prompt caching. The signature is stable.
 */

export interface CompleteOptions {
  role: ModelRole | string;
  system: string;
  user: string;
  /**
   * P4 addition — the cacheable document body.
   *
   * When present, it is placed as its own message BETWEEN system and user, so
   * the `[system][cachedContent]` prefix is byte-stable across every check on
   * an upload and OpenAI's automatic prefix cache hits. See `lib/ai/cache.ts`
   * for why ordering is the whole mechanism. Absent for P3's ingestion calls,
   * which keep working exactly as before.
   */
  cachedContent?: string;
  attribution: UsageAttribution;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface CompleteResult {
  text: string;
  modelId: string;
  latencyMs: number;
  /** Tokens served from cache on this call — the number that proves caching works. */
  cachedInputTokens: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Builds the message array.
 *
 * The cacheable content, when supplied, sits second — after system, before the
 * variable user content — so the prefix is stable. Placing it anywhere later
 * would leave the variable content in front of it and bust the cache.
 */
function buildMessages(options: CompleteOptions): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: options.system }];
  if (options.cachedContent !== undefined) {
    messages.push({ role: "user", content: options.cachedContent });
  }
  messages.push({ role: "user", content: options.user });
  return messages;
}

/** Free-text completion. */
export async function complete(
  options: CompleteOptions,
): Promise<CompleteResult> {
  const role = resolveModelRole(options.role);
  const model = resolveModel(role);
  const client = getOpenAIClient();

  const startedAt = Date.now();

  const response = await client.chat.completions.create({
    model: model.id,
    temperature: options.temperature ?? 0.2,
    // `max_completion_tokens`, not `max_tokens`: the gpt-5.x families reject
    // the older parameter with a 400 before the model ever runs.
    max_completion_tokens: options.maxOutputTokens ?? 4096,
    messages: buildMessages(options),
  });

  const latencyMs = Date.now() - startedAt;

  await recordUsage(options.attribution, role, model.id, response, latencyMs);

  const text = response.choices[0]?.message?.content ?? "";

  /*
   * Free text survives truncation — a cut-off sentence is still usable prose,
   * so this warns rather than throwing as the structured path does. It is
   * logged because the alternative is feedback that stops mid-thought with
   * nothing anywhere recording why.
   */
  if (response.choices[0]?.finish_reason === "length") {
    console.warn(
      `[ai] ${options.attribution.operation} hit its ${
        options.maxOutputTokens ?? 4096
      }-token output limit; the response is cut short.`,
    );
  }

  return {
    text,
    modelId: model.id,
    latencyMs,
    cachedInputTokens: readCachedTokens(response),
  };
}

export interface CompleteStructuredOptions<T> extends CompleteOptions {
  schema: z.ZodType<T>;
  /** Used in the error message when parsing fails. */
  schemaName: string;
}

export interface CompleteStructuredResult<T> extends CompleteResult {
  data: T;
}

/**
 * Completion constrained to a JSON shape, validated with zod before returning.
 *
 * Uses `response_format: json_object` and then re-validates, because the
 * provider guarantees syntactically valid JSON but not that it matches our
 * schema. Handing unvalidated model output to the rest of the pipeline is how
 * a malformed field becomes a constraint violation three tables later.
 *
 * `json_object` is verified working against gpt-5.4-mini on this project's key.
 * The stricter `json_schema` mode (which constrains the model to the shape
 * rather than merely to valid JSON) is an available upgrade — switch the
 * `response_format` below and keep the zod re-validation regardless, since it
 * is the real guarantee.
 */
export async function completeStructured<T>(
  options: CompleteStructuredOptions<T>,
): Promise<CompleteStructuredResult<T>> {
  const role = resolveModelRole(options.role);
  const model = resolveModel(role);
  const client = getOpenAIClient();

  const startedAt = Date.now();

  const response = await client.chat.completions.create({
    model: model.id,
    temperature: options.temperature ?? 0.1,
    // `max_completion_tokens`, not `max_tokens`: the gpt-5.x families reject
    // the older parameter with a 400 before the model ever runs.
    max_completion_tokens: options.maxOutputTokens ?? 4096,
    response_format: { type: "json_object" },
    messages: buildMessages(options),
  });

  const latencyMs = Date.now() - startedAt;

  await recordUsage(options.attribution, role, model.id, response, latencyMs);

  const raw = response.choices[0]?.message?.content ?? "";

  /*
   * Truncation is checked BEFORE parsing, because otherwise it arrives
   * disguised as a model failure.
   *
   * When the budget runs out mid-object the provider returns syntactically
   * broken JSON with `finish_reason: "length"`. JSON.parse then throws and the
   * error below would blame the model for "returning text that is not valid
   * JSON" — sending the reader after the prompt or the schema when the actual
   * cause is a number in a config file. That is exactly how DEFENSE_QUESTIONS
   * sat broken: a 4096-token cap on a ~6000-token answer, reported as
   * malformed output.
   *
   * `length` is never recoverable here — a bigger budget is the only fix — so
   * it is worth its own message naming the parameter to raise.
   */
  if (response.choices[0]?.finish_reason === "length") {
    throw new Error(
      `${options.schemaName}: model output was truncated at the ${
        options.maxOutputTokens ?? 4096
      }-token limit (finish_reason "length"). Raise maxOutputTokens for this call — the response is incomplete, not malformed.`,
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error(
      `${options.schemaName}: model returned text that is not valid JSON (${raw.slice(0, 200)})`,
    );
  }

  const validated = options.schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(
      `${options.schemaName}: model output failed validation — ${validated.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return {
    data: validated.data,
    text: raw,
    modelId: model.id,
    latencyMs,
    cachedInputTokens: readCachedTokens(response),
  };
}

/** Shape of the usage block, narrowed from the SDK response. */
interface ResponseWithUsage {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number } | null;
  } | null;
}

function readCachedTokens(response: ResponseWithUsage): number {
  return response.usage?.prompt_tokens_details?.cached_tokens ?? 0;
}

async function recordUsage(
  attribution: UsageAttribution,
  role: ModelRole,
  modelId: string,
  response: ResponseWithUsage,
  latencyMs: number,
): Promise<void> {
  const usage = response.usage;

  await logTokenUsage(
    attribution,
    role,
    modelId,
    {
      promptTokens: usage?.prompt_tokens ?? 0,
      // Absent on models without caching; a real zero and a missing field are
      // both recorded as zero, which is the honest reading either way.
      cachedPromptTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
    },
    latencyMs,
  );
}

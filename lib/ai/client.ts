// SERVER ONLY — holds the OpenAI credential.
import "server-only";

import OpenAI from "openai";

import { readServerEnv, requireOpenAIKey } from "@/lib/env";

/**
 * The single OpenAI client for the whole application.
 *
 * Nothing outside `lib/ai/complete.ts` should call this directly. Routing
 * every model call through `complete()` is what guarantees a `token_usage`
 * row is written for each one — a direct SDK call at some other site would
 * spend money invisibly, and cost-per-analysis is the number this product
 * lives or dies on.
 *
 * P5 extends this module with prompt caching; it does not replace it.
 */

let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const env = readServerEnv();
    client = new OpenAI({
      apiKey: requireOpenAIKey(env),
      // Generous but bounded. A hung request must not hold a worker slot
      // open until the platform's own timeout kills the whole invocation.
      timeout: 120_000,
      maxRetries: 2,
    });
  }
  return client;
}

/** Test seam — lets a test inject a stub without touching the env. */
export function setOpenAIClient(injected: OpenAI | undefined): void {
  client = injected;
}

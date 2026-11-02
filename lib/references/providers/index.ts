import "server-only";

import { readServerEnv } from "@/lib/env";
import {
  DEFAULT_VERIFICATION_MAILTO,
  PROVIDER_CACHE_MAX_ENTRIES,
  PROVIDER_HTTP,
  buildUserAgent,
} from "@/lib/references/config";
import {
  logProviderCall,
  type ProviderOutcome,
} from "@/lib/references/providerLog";
import {
  providerRecordSchema,
  type ProviderName,
  type ProviderRecord,
} from "@/lib/validations/reference";

/**
 * The uniform provider layer.
 *
 * Every scholarly source sits behind the SAME interface and returns the SAME
 * normalised `ProviderRecord`. A caller in `verify.ts` cannot tell Crossref
 * from OpenAlex from the result — no provider-specific field ever crosses this
 * boundary. This file owns the three things every adapter shares: the polite
 * HTTP client (timeout, backoff, size cap, project `mailto`), the in-run cache,
 * and a small concurrency limiter.
 */

// ---------------------------------------------------------------------------
// The uniform adapter contract
// ---------------------------------------------------------------------------

export interface ProviderContext {
  /** Fixed project contact for the polite pool. Never a student's address. */
  mailto: string;
  /** In-run memo cache — 80 references must not re-hit an API for the same DOI. */
  cache: ProviderCache;
  /** Optional Semantic Scholar key for higher limits. */
  semanticScholarApiKey?: string;
}

export interface ReferenceProvider {
  readonly name: ProviderName;
  byDoi?(doi: string, ctx: ProviderContext): Promise<ProviderRecord>;
  byIsbn?(isbn: string, ctx: ProviderContext): Promise<ProviderRecord>;
  byQuery?(query: string, ctx: ProviderContext): Promise<ProviderRecord>;
}

/** A "no match" record — the honest normalised answer when nothing is found. */
export function notFound(source: ProviderName): ProviderRecord {
  return {
    found: false,
    title: null,
    authors: [],
    year: null,
    doi: null,
    url: null,
    source,
  };
}

/** Validates and normalises an adapter's assembled record before it escapes. */
export function normaliseRecord(
  input: unknown,
  source: ProviderName,
): ProviderRecord {
  const parsed = providerRecordSchema.safeParse(input);
  if (!parsed.success) return notFound(source);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Provider context
// ---------------------------------------------------------------------------

/** Builds the per-run context: the project mailto and a fresh in-run cache. */
export function makeProviderContext(): ProviderContext {
  const env = readServerEnv();
  return {
    mailto: env.REFERENCE_VERIFICATION_MAILTO ?? DEFAULT_VERIFICATION_MAILTO,
    cache: new ProviderCache(),
    semanticScholarApiKey: env.SEMANTIC_SCHOLAR_API_KEY,
  };
}

// ---------------------------------------------------------------------------
// In-run cache — bounded, keyed by provider + normalised target
// ---------------------------------------------------------------------------

export class ProviderCache {
  private readonly store = new Map<string, ProviderRecord>();

  get(key: string): ProviderRecord | undefined {
    return this.store.get(key);
  }

  set(key: string, value: ProviderRecord): void {
    // Simple FIFO bound — insertion order is Map's iteration order.
    if (this.store.size >= PROVIDER_CACHE_MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, value);
  }
}

/** Memoises an adapter call by (provider, kind, target). */
export async function withCache(
  ctx: ProviderContext,
  source: ProviderName,
  kind: string,
  target: string,
  compute: () => Promise<ProviderRecord>,
): Promise<ProviderRecord> {
  const key = `${source}:${kind}:${target.toLowerCase()}`;
  const cached = ctx.cache.get(key);
  if (cached) return cached;

  const value = await compute();
  ctx.cache.set(key, value);
  return value;
}

// ---------------------------------------------------------------------------
// Polite HTTP — timeout, retry-with-backoff on 429/5xx, response-size cap
// ---------------------------------------------------------------------------

export interface PoliteResponse {
  ok: boolean;
  status: number;
  /** Final URL after redirects — the number that catches a fabricated DOI. */
  finalUrl: string;
  /**
   * The `Location` header, when the server answered with a redirect instead of
   * following it. Only populated under `redirect: "manual"`, which is the only
   * way to read a 3xx as an answer in its own right — see `doiResolve.ts`,
   * where the redirect IS the proof the identifier is registered.
   */
  location: string | null;
  text: string;
}

export interface PoliteFetchOptions {
  method?: "GET" | "HEAD";
  accept?: string;
  mailto: string;
  apiKey?: string;
  apiKeyHeader?: string;
  redirect?: "follow" | "manual";
  /** Short label for the provider log. Public data only — never document text. */
  logProvider: ProviderName;
  logTarget: string;
}

/**
 * Fetches an external URL with the etiquette every scholarly API expects.
 *
 * - a project User-Agent carrying the polite-pool mailto,
 * - a hard AbortController timeout,
 * - retry with exponential backoff on 429 and 5xx, honouring `Retry-After`,
 * - a response-size cap, because an external body is untrusted input.
 *
 * Returns the response even on a non-2xx status; only a network/timeout failure
 * after all retries throws. Callers decide what a 404 means for their check.
 */
export async function politeFetch(
  url: string,
  options: PoliteFetchOptions,
): Promise<PoliteResponse> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= PROVIDER_HTTP.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER_HTTP.timeoutMs);

    try {
      const headers: Record<string, string> = {
        "User-Agent": buildUserAgent(options.mailto),
      };
      if (options.accept) headers["Accept"] = options.accept;
      if (options.apiKey && options.apiKeyHeader) {
        headers[options.apiKeyHeader] = options.apiKey;
      }

      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        redirect: options.redirect ?? "follow",
        signal: controller.signal,
        cache: "no-store",
      });

      // Retry on transient failures, respecting the server's backoff hint.
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < PROVIDER_HTTP.maxRetries
      ) {
        const wait = retryAfterMs(response.headers.get("retry-after"), attempt);
        clearTimeout(timer);
        await delay(wait);
        continue;
      }

      const text = await readCapped(response);
      clearTimeout(timer);

      logProviderCall({
        provider: options.logProvider,
        target: options.logTarget,
        outcome: outcomeForStatus(response.status),
        status: response.status,
        latencyMs: Date.now() - startedAt,
      });

      return {
        ok: response.ok,
        status: response.status,
        finalUrl: response.url || url,
        location: response.headers.get("location"),
        text,
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const isTimeout = error instanceof Error && error.name === "AbortError";
      if (attempt < PROVIDER_HTTP.maxRetries && !isTimeout) {
        await delay(PROVIDER_HTTP.backoffBaseMs * 2 ** attempt);
        continue;
      }
      logProviderCall({
        provider: options.logProvider,
        target: options.logTarget,
        outcome: isTimeout ? "timeout" : "error",
        latencyMs: Date.now() - startedAt,
        note: isTimeout ? "aborted" : "network",
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("politeFetch: exhausted retries");
}

function outcomeForStatus(status: number): ProviderOutcome {
  if (status === 429) return "rate_limited";
  if (status >= 500 || status === 408) return "error";
  if (status >= 200 && status < 300) return "hit";
  // A 3xx only reaches here under `redirect: "manual"`, where the caller asked
  // to see it. For doi.org that redirect is a successful lookup, so logging it
  // as a miss would make a healthy resolver look like a failing one.
  if (status >= 300 && status < 400) return "hit";
  return "miss";
}

function retryAfterMs(header: string | null, attempt: number): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0)
      return Math.min(seconds * 1000, 10_000);
  }
  return PROVIDER_HTTP.backoffBaseMs * 2 ** attempt;
}

async function readCapped(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > PROVIDER_HTTP.maxResponseBytes) {
    // Too big to be a legitimate bibliographic record — do not read it.
    return "";
  }
  const text = await response.text();
  return text.length > PROVIDER_HTTP.maxResponseBytes
    ? text.slice(0, PROVIDER_HTTP.maxResponseBytes)
    : text;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parses a JSON body defensively — an unparseable external body is not a crash. */
export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Concurrency limiter — verify 80 references without hammering any one API
// ---------------------------------------------------------------------------

/** Runs `worker` over `items` with at most `limit` in flight at once. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index] as T, index);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

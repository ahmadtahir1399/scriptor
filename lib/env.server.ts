// SERVER ONLY — this module reads secrets (service-role key, OpenAI key).
// The `server-only` import makes a client-component import fail at build time
// rather than silently shipping the keys to the browser.
import "server-only";

import { readServerEnv, type ServerEnv } from "./env";

/**
 * Validated server environment. Evaluated once at module load so a missing or
 * malformed secret crashes the server at boot with a message naming the
 * variable, instead of surfacing as a confusing 500 later.
 */
export const serverEnv: ServerEnv = readServerEnv();

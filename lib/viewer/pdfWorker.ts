"use client";

import * as pdfjs from "pdfjs-dist";

/**
 * pdfjs worker configuration — the #1 pdfjs-in-Next failure point.
 *
 * The worker is loaded from a LOCAL, bundler-resolvable asset, never a CDN.
 * `new URL("...", import.meta.url)` makes the bundler (Turbopack / webpack)
 * resolve the file, fingerprint it, and emit it as a static asset, then hands
 * back the emitted URL at runtime. A hard-coded CDN string would break offline,
 * pin a version that can drift from the API build, and send a request to a
 * third party — which this feature must never do.
 *
 * Path verified against the INSTALLED build: pdfjs-dist@4.10.38 ships the ESM
 * worker at `build/pdf.worker.min.mjs` (no exports map; the subpath resolves to
 * the file directly). If the version changes, re-check this filename — it has
 * changed between majors (`.js` → `.mjs`) and is not safe to assume.
 *
 * Idempotent: configured once on first import, guarded so re-imports are no-ops.
 */

let configured = false;

export function ensurePdfWorker(): typeof pdfjs {
  if (!configured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    configured = true;
  }
  return pdfjs;
}

export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

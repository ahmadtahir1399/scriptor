"use client";

import { requestDocumentUrl } from "@/lib/viewer/actions";

/**
 * Client wrapper around the signed-URL action.
 *
 * `usePdfDocument` calls this on load and again whenever pdfjs reports a fetch
 * failure — the 60-second URL will expire during a long read, and a fresh mint
 * keeps the document open without the student ever seeing a broken page.
 */
export async function fetchDocumentUrl(analysisId: string): Promise<string> {
  const result = await requestDocumentUrl({ analysisId });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.url;
}

"use client";

import * as React from "react";

import { ensurePdfWorker, type PDFDocumentProxy } from "@/lib/viewer/pdfWorker";
import { fetchDocumentUrl } from "@/lib/viewer/signedUrl";

/**
 * Loads a PDF into pdfjs from a signed URL, and keeps it loaded.
 *
 * Reused by P11's guideline preview — same loader, different document. The
 * signed URL is fetched on mount and RE-FETCHED transparently if pdfjs reports
 * a fetch failure (the 60s URL expiring mid-read is the common case), so the
 * student never sees a broken document during a long session.
 *
 * Everything here runs in the browser: the bytes go from Supabase Storage
 * straight to pdfjs and are rendered locally. No text or geometry is sent
 * anywhere else.
 */

export type PdfStatus = "loading" | "ready" | "error";

export interface PdfDocumentState {
  pdf: PDFDocumentProxy | null;
  numPages: number;
  status: PdfStatus;
  reload: () => void;
}

export function usePdfDocument(analysisId: string): PdfDocumentState {
  const [pdf, setPdf] = React.useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [status, setStatus] = React.useState<PdfStatus>("loading");
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;

    async function load() {
      setStatus("loading");
      try {
        const pdfjs = ensurePdfWorker();
        const url = await fetchDocumentUrl(analysisId);

        const task = pdfjs.getDocument({ url, isEvalSupported: false });
        doc = await task.promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }

        setPdf(doc);
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          console.error("[viewer] PDF load failed", error);
          setStatus("error");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (doc) void doc.destroy();
    };
  }, [analysisId, attempt]);

  const reload = React.useCallback(() => setAttempt((value) => value + 1), []);

  return { pdf, numPages, status, reload };
}

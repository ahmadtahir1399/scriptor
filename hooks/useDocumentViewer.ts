"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { listFindings } from "@/lib/db/queries/findings";
import { listPages, listWordsForPages } from "@/lib/db/queries/papers";
import type { Finding } from "@/lib/domain/analysis";
import type { PaperPage, Word } from "@/lib/domain/paper";

/**
 * The viewer's data: findings, page metadata, and the word geometry for pages
 * that carry a finding.
 *
 * All reads go through `lib/db/queries` with the BROWSER client, so RLS applies
 * and there is no inline `.from()` here. Words are fetched ONLY for pages with
 * findings — the whole point of not pulling ~50,000 rows — and grouped by page
 * so a `PdfPage` can look up its own words in O(1).
 */

export interface ViewerData {
  findings: Finding[];
  pages: PaperPage[];
  wordsByPage: Map<number, Word[]>;
  isLoading: boolean;
  isError: boolean;
}

export function useDocumentViewer(analysisId: string, uploadId: string): ViewerData {
  const findingsQuery = useQuery({
    queryKey: ["viewer-findings", analysisId],
    queryFn: async () => {
      const db = createClient();
      return listFindings(db, analysisId);
    },
    staleTime: 5000,
  });

  const pagesQuery = useQuery({
    queryKey: ["viewer-pages", uploadId],
    queryFn: async () => {
      const db = createClient();
      return listPages(db, uploadId);
    },
    staleTime: 60_000,
  });

  const findings = React.useMemo(() => findingsQuery.data ?? [], [findingsQuery.data]);

  // The set of pages that actually need geometry — those with a finding.
  const findingPages = React.useMemo(() => {
    const set = new Set<number>();
    for (const finding of findings) {
      if (finding.page_number !== null) set.add(finding.page_number);
    }
    return [...set].sort((a, b) => a - b);
  }, [findings]);

  const wordsQuery = useQuery({
    queryKey: ["viewer-words", uploadId, findingPages],
    queryFn: async () => {
      const db = createClient();
      return listWordsForPages(db, uploadId, findingPages);
    },
    enabled: findingPages.length > 0,
    staleTime: 60_000,
  });

  const wordsByPage = React.useMemo(() => {
    const map = new Map<number, Word[]>();
    for (const word of wordsQuery.data ?? []) {
      const list = map.get(word.page_number);
      if (list) list.push(word);
      else map.set(word.page_number, [word]);
    }
    return map;
  }, [wordsQuery.data]);

  return {
    findings,
    pages: pagesQuery.data ?? [],
    wordsByPage,
    isLoading: findingsQuery.isLoading || pagesQuery.isLoading,
    isError: findingsQuery.isError || pagesQuery.isError,
  };
}

import * as React from "react";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getAnalysisReportHeader,
  getAnalysisStatuses,
} from "@/lib/db/queries/analyses";
import { loadReferenceHealth } from "@/lib/db/queries/references";
import { summariseHealth } from "@/lib/domain/reference";
import { getTodoProgress } from "@/lib/db/queries/todos";
import { getDefenseQuestionCount } from "@/lib/db/queries/defense";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { AnalysisSubNav } from "@/components/analysis/AnalysisSubNav";
import { AnalysisHeaderActions } from "@/components/analysis/AnalysisHeaderActions";

/**
 * The analysis shell shared by every sub-page (Overview here, Document /
 * References / To-dos / Defense in later prompts).
 *
 * Owns the header read so sub-pages don't refetch it. Loads through an
 * RLS-scoped query: another user's analysis id resolves to null → not-found,
 * never a permission error that would confirm the id exists.
 */
export default async function AnalysisLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; analysisId: string }>;
}) {
  const { locale, analysisId } = await params;
  setRequestLocale(locale);

  const db = await createClient();
  const header = await getAnalysisReportHeader(db, analysisId);

  if (!header) {
    notFound();
  }

  // Reference issue count + to-do progress for the sub-nav badges — only when
  // those features ran.
  const statuses = await getAnalysisStatuses(db, analysisId);
  let referenceIssueCount = 0;
  if (statuses && statuses.reference_health_status !== "NONE") {
    const snapshot = await loadReferenceHealth(db, analysisId);
    const summary = summariseHealth(snapshot.bibliography, snapshot.pairs);
    referenceIssueCount =
      summary.missingEntries +
      summary.needsCorrection +
      summary.brokenUrl +
      summary.notFound;
  }

  let todoProgress: { done: number; total: number } | undefined;
  if (statuses && statuses.todo_status !== "NONE") {
    todoProgress = await getTodoProgress(db, analysisId);
  }

  let defenseCount = 0;
  if (statuses && statuses.defense_status !== "NONE") {
    defenseCount = await getDefenseQuestionCount(db, analysisId);
  }

  const t = await getTranslations("analysis");
  const format = await getFormatter();

  const relative = format.relativeTime(
    new Date(header.completedAt ?? header.createdAt),
  );
  const title = header.paperTitle || header.fileName || t("untitled");
  const docTypeLabel = header.documentTypeCode
    ? t(`docType.${header.documentTypeCode}`)
    : null;

  return (
    <div>
      <PageHeader
        title={title}
        actions={<AnalysisHeaderActions analysisId={analysisId} />}
        description={[docTypeLabel, t("analysed", { time: relative })]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="mb-6">
        <AnalysisSubNav
          analysisId={analysisId}
          referenceIssueCount={referenceIssueCount}
          todoProgress={todoProgress}
          defenseCount={defenseCount}
        />
      </div>

      <Badge variant="outline" className="sr-only">
        {header.status}
      </Badge>

      {children}
    </div>
  );
}

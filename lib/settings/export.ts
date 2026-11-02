import "server-only";

import type { Db } from "@/lib/db/queries/papers";
import { getProfile } from "@/lib/db/queries/identity";
import { getNotificationPreferences } from "@/lib/db/queries/settings";
import { listPapers, listUploadsForPaper } from "@/lib/db/queries/papers";
import { listAnalysesForPaper } from "@/lib/db/queries/analyses";
import {
  listAllRequirements,
  listRequirementFiles,
} from "@/lib/db/queries/requirements";

/**
 * Assembles everything Scriptor holds about the user into an exportable object.
 *
 * Built entirely from RLS-scoped reads on the passed-in USER client — so it can
 * only ever contain the caller's own data, never another user's. Returns a plain
 * serialisable object; the action stringifies it and the browser downloads it as
 * a Blob. No public URL is ever minted.
 */
export async function buildExportBundle(
  db: Db,
  userId: string,
): Promise<Record<string, unknown>> {
  const [profile, preferences, papers, requirementFiles, requirements] =
    await Promise.all([
      getProfile(db, userId),
      getNotificationPreferences(db, userId),
      listPapers(db),
      listRequirementFiles(db),
      listAllRequirements(db),
    ]);

  const paperExports = await Promise.all(
    papers.map(async (paper) => {
      const [uploads, analyses] = await Promise.all([
        listUploadsForPaper(db, paper.id),
        listAnalysesForPaper(db, paper.id),
      ]);
      return {
        id: paper.id,
        title: paper.title,
        createdAt: paper.created_at,
        versions: uploads.map((upload) => ({
          id: upload.id,
          fileName: upload.file_name,
          pageCount: upload.page_count,
          wordCount: upload.word_count,
          autoDelete: upload.auto_delete,
          createdAt: upload.created_at,
        })),
        analyses: analyses.map((analysis) => ({
          id: analysis.id,
          status: analysis.status,
          overallScore: analysis.overall_score,
          createdAt: analysis.created_at,
        })),
      };
    }),
  );

  return {
    exportedAt: new Date().toISOString(),
    note: "This is everything Scriptor holds about your account. Your documents are never used for training and are never shared externally.",
    profile: profile
      ? {
          email: profile.email,
          fullName: profile.full_name,
          language: profile.locale,
          createdAt: profile.created_at,
        }
      : null,
    notificationPreferences: preferences,
    papers: paperExports,
    requirements: {
      files: requirementFiles.map((file) => ({
        id: file.id,
        name: file.file_name,
        createdAt: file.created_at,
      })),
      rules: requirements.map((rule) => ({
        id: rule.id,
        title: rule.title,
        category: rule.category,
      })),
    },
  };
}

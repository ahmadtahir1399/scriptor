import "server-only";

import type { Db } from "@/lib/db/queries/papers";
import {
  clearRequirementsForFile,
  getRequirementFileMeta,
  insertRequirements,
  setRequirementFileStatus,
} from "@/lib/db/queries/requirements";
import { looksLikePdf, parsePdf } from "@/lib/ingestion/parsePdf";
import { extractRequirements } from "@/lib/requirements/extract";
import { EXTRACTION_LIMITS } from "@/lib/requirements/config";
import { REQUIREMENTS_BUCKET } from "@/lib/upload/constants";
import { notifyRequirementsExtracted } from "@/lib/notifications/events";

/**
 * Guideline extraction orchestration.
 *
 * NOTE ON WHY THIS ISN'T AN `analysis_jobs` HANDLER: that queue's
 * `paper_analysis_id` and `paper_upload_id` are NOT NULL, so a file-only
 * extraction (which has neither) cannot be represented as an analysis job. The
 * guidelines doc is also small, so extraction runs inline from
 * `finaliseGuidelineUpload` under the service role — the `EXTRACT_REQUIREMENTS`
 * / `UNIVERSITY_EXTRACTION` job kinds are the seat for a future dedicated queue.
 *
 * IDEMPOTENT: clears the file's prior requirements before writing, so a
 * re-extract replaces rather than duplicates. HONEST: a scanned, empty or
 * unreadable guidelines file is marked ERROR with a specific reason — never
 * garbage requirements, mirroring P2's compatibility gate.
 *
 * Never throws: any failure is recorded on the file as an ERROR status so the
 * UI can show it, and the caller (a server action) stays clean.
 */
export async function runGuidelineExtraction(
  db: Db,
  requirementFileId: string,
): Promise<void> {
  const file = await getRequirementFileMeta(db, requirementFileId);
  if (!file) return;

  try {
    await setRequirementFileStatus(db, requirementFileId, "GENERATING");

    const download = await db.storage
      .from(REQUIREMENTS_BUCKET)
      .download(file.file_path);
    if (download.error || !download.data) {
      await setRequirementFileStatus(
        db,
        requirementFileId,
        "ERROR",
        "download_failed",
      );
      return;
    }
    const bytes = new Uint8Array(await download.data.arrayBuffer());

    // Server-side magic-byte check — the only claim about the file the uploader
    // does not control.
    if (!looksLikePdf(bytes)) {
      await setRequirementFileStatus(db, requirementFileId, "ERROR", "not_pdf");
      return;
    }

    const parsed = await parsePdf(bytes);
    const text = parsed.pages
      .map((page) => page.text)
      .join("\n\n")
      .trim();

    // A scanned or empty guide yields no extractable text — degrade to a clear
    // reason rather than inventing rules.
    if (text.length < EXTRACTION_LIMITS.minGuidelineChars) {
      await setRequirementFileStatus(
        db,
        requirementFileId,
        "ERROR",
        "empty_or_scanned",
      );
      return;
    }

    await clearRequirementsForFile(db, requirementFileId);

    const requirements = await extractRequirements({
      guidelineText: text,
      attribution: {
        paperUploadId: null,
        paperAnalysisId: null,
        analysisJobId: null,
        userId: file.user_id,
        operation: "EXTRACT_REQUIREMENTS",
      },
    });

    await insertRequirements(
      db,
      requirementFileId,
      requirements.map((requirement, index) => ({
        title: requirement.title,
        description: requirement.description,
        category: requirement.category,
        sourceQuote: requirement.sourceQuote,
        isMandatory: requirement.isMandatory,
        sortOrder: index,
      })),
    );

    await setRequirementFileStatus(db, requirementFileId, "DONE");

    // After the status write, never before: the notification tells the student
    // their requirements are ready, and the page it links to reads that status.
    // `notifyRequirementsExtracted` swallows its own failures, so a mail
    // problem cannot flip a successful extraction into the ERROR branch below.
    await notifyRequirementsExtracted(db, {
      userId: file.user_id,
      sourceName: file.title || file.file_name,
      requirements,
    });
  } catch (error) {
    console.error(
      `[requirements] extraction failed for ${requirementFileId}`,
      error,
    );
    await setRequirementFileStatus(
      db,
      requirementFileId,
      "ERROR",
      "extraction_failed",
    );
  }
}

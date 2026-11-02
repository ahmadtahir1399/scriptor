import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getAnalysis } from "@/lib/db/queries/analyses";
import { getUpload, hasWordGeometry } from "@/lib/db/queries/papers";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";

/**
 * The inline document viewer.
 *
 * Lives under P5's analysis layout, so the header and RLS not-found check are
 * already done there. This resolves the upload and decides whether inline
 * highlights are possible: a PDF with word geometry gets the full viewer; a
 * DOCX or a geometry-less parse falls back to a findings-only list (decided
 * here, rendered by DocumentViewer).
 *
 * All reads are RLS-scoped; the PDF itself is fetched client-side via a
 * server-minted 60s signed URL. No document bytes pass through this server
 * render.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ locale: string; analysisId: string }>;
}) {
  const { locale, analysisId } = await params;
  setRequestLocale(locale);

  const db = await createClient();

  const analysis = await getAnalysis(db, analysisId);
  if (!analysis) {
    notFound();
  }

  const upload = await getUpload(db, analysis.paper_upload_id);
  if (!upload) {
    notFound();
  }

  const geometryAvailable =
    upload.file_format === "PDF" && (await hasWordGeometry(db, upload.id));

  return (
    <DocumentViewer
      analysisId={analysisId}
      uploadId={upload.id}
      geometryAvailable={geometryAvailable}
    />
  );
}

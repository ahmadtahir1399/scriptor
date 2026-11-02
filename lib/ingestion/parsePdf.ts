import "server-only";

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildPageText,
  extractWordsFromItems,
  type ExtractedWord,
  type TextItemLike,
} from "@/lib/ingestion/extractWords";

/**
 * Server-side PDF parsing.
 *
 * Verified against pdfjs-dist 4.10.38. Four things about running it under Node
 * rather than a browser, each of which fails differently if changed:
 *
 *   1. The `legacy/` build. The default entry assumes a browser and dies on
 *      `DOMMatrix`.
 *   2. `GlobalWorkerOptions.workerSrc`. There is no Worker global, so pdf.js
 *      uses a "fake worker" that dynamically imports whatever this points at.
 *      Leaving it empty throws `No "GlobalWorkerOptions.workerSrc" specified`.
 *   3. The data directories (`standard_fonts/`, `cmaps/`). Node's factories
 *      read these off disk; omitting them degrades text extraction rather than
 *      throwing, which is the nastiest of the four to notice. See getDocument.
 *   4. `serverExternalPackages: ["pdfjs-dist"]` in next.config.ts, so the
 *      bundler leaves all of the above resolving against real node_modules.
 */

export interface ParsedPage {
  pageNumber: number;
  text: string;
  words: ExtractedWord[];
  /** PDF units. Stored so P7 can scale at render time. */
  pageWidth: number;
  pageHeight: number;
}

export interface ParsedDocument {
  pages: ParsedPage[];
  pageCount: number;
  totalWords: number;
  totalChars: number;
}

/**
 * Directory of the real, on-disk pdfjs-dist package.
 *
 * Built from cwd rather than `require.resolve`: the bundler rewrites any
 * recognised module specifier into a .next chunk path, which contains none of
 * the data files below. A plain string it does not recognise keeps pointing at
 * node_modules, where `standard_fonts/` and `cmaps/` actually live.
 */
function pdfjsPackageDir(): string {
  return path.join(process.cwd(), "node_modules", "pdfjs-dist");
}

/**
 * Asset directories for the Node data factories.
 *
 * pdf.js's Node factories read these with `fs.readFile(baseUrl + filename)`, so
 * these must be filesystem paths — NOT file:// URLs — and must end in a
 * separator, because pdf.js concatenates the filename straight onto them.
 */
function assetPaths(): { standardFontDataUrl: string; cMapUrl: string } {
  const root = pdfjsPackageDir();
  return {
    standardFontDataUrl: path.join(root, "standard_fonts") + path.sep,
    cMapUrl: path.join(root, "cmaps") + path.sep,
  };
}

/** Loaded lazily so importing this module never pulls pdf.js into a bundle. */
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // In Node there is no Worker global, so pdf.js falls back to a "fake worker"
  // that dynamically imports whatever `workerSrc` points at. An empty string is
  // falsy and makes it throw `No "GlobalWorkerOptions.workerSrc" specified`, so
  // point it at the real worker file — resolved through the package and turned
  // into a file:// URL, since dynamic import cannot load a raw Windows path.
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    // Unlike the data files below, the worker is *dynamically imported* rather
    // than read off disk, and import() cannot take a raw Windows path — so this
    // one does need to be a file:// URL.
    const workerPath = path.join(
      pdfjsPackageDir(),
      "legacy",
      "build",
      "pdf.worker.min.mjs",
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }
  return pdfjs;
}

/**
 * Parses a PDF into pages, text and word geometry.
 *
 * Takes the file as bytes rather than a path so the caller decides where it
 * came from — storage here, an upload buffer in P11.
 */
export async function parsePdf(bytes: Uint8Array): Promise<ParsedDocument> {
  const pdfjs = await loadPdfJs();

  const { standardFontDataUrl, cMapUrl } = assetPaths();

  const document = await pdfjs.getDocument({
    data: bytes,
    // We never rasterise, so no glyphs are drawn. These two keep pdf.js off the
    // rendering path without touching how text is decoded.
    disableFontFace: true,
    isEvalSupported: false,

    /*
     * FONT DATA IS NOT OPTIONAL FOR TEXT EXTRACTION.
     *
     * It is tempting to read `standardFontDataUrl` as a rendering concern and
     * skip it — that is what produced "Ensure that the `standardFontDataUrl`
     * API parameter is provided." on every single parse. But for a document
     * that references one of the standard 14 fonts WITHOUT embedding it, pdf.js
     * derives the glyph-to-Unicode mapping from this data. Without it there is
     * no mapping to derive, and `getTextContent()` hands back characters that
     * do not match what is on the page — which then flows into every prompt.
     *
     * `useSystemFonts: false` makes that dependency unconditional: it tells
     * pdf.js not to substitute a local system font, so the bundled data is the
     * only source left. The two settings go together.
     */
    useSystemFonts: false,
    standardFontDataUrl,

    // Same argument for CJK and other multi-byte encodings: the character maps
    // are what turn CID codes into Unicode. `cMapPacked` matches the .bcmap
    // files the package ships.
    cMapUrl,
    cMapPacked: true,

    // Keep the data factories on this thread, where the Node fs-backed ones
    // above can actually be used.
    useWorkerFetch: false,
  }).promise;

  const pages: ParsedPage[] = [];
  let totalWords = 0;
  let totalChars = 0;

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);

      try {
        // scale 1 — raw PDF units. Storing pixels would bake in a zoom level
        // and break the viewer at any other scale.
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();

        // getTextContent() yields both text items and marked-content markers;
        // only the former carry a transform.
        const items = (content.items as unknown[]).filter(
          (item): item is TextItemLike =>
            typeof item === "object" &&
            item !== null &&
            "str" in item &&
            "transform" in item,
        );

        const text = buildPageText(items);
        const words = extractWordsFromItems(items, viewport.height);

        totalWords += words.length;
        totalChars += text.length;

        pages.push({
          pageNumber,
          text,
          words,
          pageWidth: viewport.width,
          pageHeight: viewport.height,
        });
      } finally {
        // Without this, pdf.js retains every page's operator list and a long
        // thesis exhausts memory before the parse finishes.
        page.cleanup();
      }
    }
  } finally {
    await document.destroy();
  }

  return {
    pages,
    pageCount: document.numPages,
    totalWords,
    totalChars,
  };
}

/**
 * Magic-byte check.
 *
 * A client-side `accept` attribute and a Content-Type header are both hints
 * supplied by the caller. This reads the actual first bytes, which is the only
 * statement about the file the uploader does not control.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  // "%PDF-"
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/* Validates the generated fixture against the app's own parser + gate rules. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const file = process.argv[2];
const bytes = new Uint8Array(fs.readFileSync(file));

const magic = Buffer.from(bytes.slice(0, 5)).toString("latin1");
console.log("magic bytes:", JSON.stringify(magic), magic === "%PDF-" ? "OK" : "FAIL");

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
  ).href;
}

const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;

let totalWords = 0;
let totalChars = 0;
const perPage = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const text = content.items.map((i) => i.str ?? "").join(" ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  totalWords += words;
  totalChars += text.length;
  perPage.push({ page: p, words, chars: text.length });
}

console.log("pages:", doc.numPages);
for (const p of perPage) console.log(`  page ${p.page}: ${p.words} words, ${p.chars} chars`);
console.log("totalWords:", totalWords, " totalChars:", totalChars);

const LIMITS = { minCharsPerPage: 100, minWords: 500, maxWords: 48000, maxPages: 300 };
const charsPerPage = totalChars / doc.numPages;

const checks = [
  ["not UNREADABLE (words>0 && chars>0)", totalWords > 0 && totalChars > 0],
  [`not SCANNED_PDF (chars/page ${Math.round(charsPerPage)} >= ${LIMITS.minCharsPerPage})`, charsPerPage >= LIMITS.minCharsPerPage],
  [`not TOO_MANY_PAGES (${doc.numPages} <= ${LIMITS.maxPages})`, doc.numPages <= LIMITS.maxPages],
  [`not TOO_SHORT (${totalWords} >= ${LIMITS.minWords})`, totalWords >= LIMITS.minWords],
  [`not TOO_LONG (${totalWords} <= ${LIMITS.maxWords})`, totalWords <= LIMITS.maxWords],
];

console.log("\ncompatibility gate:");
let allOk = true;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) allOk = false;
}
console.log(`\nVERDICT: ${allOk ? "compatible — analysis will run" : "would be rejected"}`);

const first = await (await doc.getPage(1)).getTextContent();
console.log("\nfirst 200 chars of page 1:");
console.log("  " + first.items.map((i) => i.str ?? "").join(" ").replace(/\s+/g, " ").trim().slice(0, 200));

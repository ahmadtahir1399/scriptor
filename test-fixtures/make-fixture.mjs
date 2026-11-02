import fs from "node:fs";
import path from "node:path";

/* Minimal, dependency-free PDF writer: A4, Helvetica, correct xref offsets. */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 60;
const LEADING = 15;
const BODY_SIZE = 11;
const H1_SIZE = 15;
const H2_SIZE = 12;
const MAX_CHARS = 92;
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN) / LEADING);

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text, width) {
  const out = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      if ((line + " " + word).trim().length > width) {
        out.push(line.trim());
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) out.push(line.trim());
  }
  return out;
}

const SRC = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const flowed = [];
function push(text, size, bold) {
  const width = size >= H1_SIZE ? 70 : MAX_CHARS;
  for (const l of wrap(text, width)) flowed.push({ text: l, size, bold });
}
const blank = () => flowed.push({ text: "", size: BODY_SIZE, bold: false });

push(SRC.title, H1_SIZE, true);
blank();
push(SRC.byline, BODY_SIZE, false);
blank();
for (const sec of SRC.sections) {
  push(sec.heading, H2_SIZE, true);
  for (const p of sec.paragraphs) {
    push(p, BODY_SIZE, false);
    blank();
  }
}

const pages = [];
for (let i = 0; i < flowed.length; i += LINES_PER_PAGE) {
  pages.push(flowed.slice(i, i + LINES_PER_PAGE));
}

const objects = [null, null, null, null]; // reserve ids 1..4
function add(body) {
  objects.push(body);
  return objects.length;
}

const CATALOG = 1;
const PAGES = 2;
const FONT_REG = 3;
const FONT_BOLD = 4;

const pageIds = [];
for (const lines of pages) {
  let content = "";
  let y = PAGE_H - MARGIN;
  for (const ln of lines) {
    if (ln.text) {
      const f = ln.bold ? "/F2" : "/F1";
      content += "BT " + f + " " + ln.size + " Tf " + MARGIN + " " + Math.round(y) +
        " Td (" + esc(ln.text) + ") Tj ET\n";
    }
    y -= LEADING;
  }
  const len = Buffer.byteLength(content, "latin1");
  const streamId = add("<< /Length " + len + " >>\nstream\n" + content + "endstream");
  const pageId = add(
    "<< /Type /Page /Parent " + PAGES + " 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H + "] " +
      "/Resources << /Font << /F1 " + FONT_REG + " 0 R /F2 " + FONT_BOLD + " 0 R >> >> " +
      "/Contents " + streamId + " 0 R >>",
  );
  pageIds.push(pageId);
}

objects[CATALOG - 1] = "<< /Type /Catalog /Pages " + PAGES + " 0 R >>";
objects[PAGES - 1] =
  "<< /Type /Pages /Kids [" + pageIds.map((i) => i + " 0 R").join(" ") +
  "] /Count " + pageIds.length + " >>";
objects[FONT_REG - 1] =
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
objects[FONT_BOLD - 1] =
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, idx) => {
  offsets[idx] = Buffer.byteLength(pdf, "latin1");
  pdf += idx + 1 + " 0 obj\n" + body + "\nendobj\n";
});

const xrefStart = Buffer.byteLength(pdf, "latin1");
pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
for (const off of offsets) {
  pdf += String(off).padStart(10, "0") + " 00000 n \n";
}
pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root " + CATALOG +
  " 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF\n";

const outPath = path.join(path.dirname(process.argv[2]), SRC.filename);
fs.writeFileSync(outPath, Buffer.from(pdf, "latin1"));

const words = SRC.sections
  .flatMap((s) => s.paragraphs)
  .join(" ")
  .split(/\s+/)
  .filter(Boolean).length;

console.log("wrote " + outPath);
console.log("pages=" + pages.length + "  source words=" + words + "  bytes=" + fs.statSync(outPath).size);

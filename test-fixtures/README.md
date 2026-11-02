# Test fixtures

Sample documents for exercising the upload → parse → analyse flow by hand.

## `sample-seminar-paper.pdf`

A 4-page, ~1,400-word history seminar paper with an abstract, numbered
sections and eight real book references. Built to clear every rule in
`lib/ingestion/compatibility.ts`:

| gate | limit | this file |
| --- | --- | --- |
| `TOO_SHORT` | ≥ 500 words | 1,403 |
| `TOO_LONG` | ≤ 48,000 words | 1,403 |
| `SCANNED_PDF` | ≥ 100 chars/page | 2,393 |
| `TOO_MANY_PAGES` | ≤ 300 pages | 4 |
| `NO_BODY_CONTENT` | ≥ 1 BODY page | prose sections |

The reference list uses genuine, widely-indexed works, so the reference
verification pass has something real to resolve against Crossref/OpenAlex
rather than failing on invented citations.

## Scripts

Both are plain Node, no dependencies beyond what the app already installs.
Run them inside the dev container (see `docker-compose.yml`).

**Regenerate the PDF** after editing `sample-seminar-paper.json`:

```sh
docker compose exec -T -w /app dev \
  node test-fixtures/make-fixture.mjs test-fixtures/sample-seminar-paper.json
```

`make-fixture.mjs` writes an uncompressed PDF 1.4 with correct xref offsets —
handy for building variants that deliberately trip a gate (truncate the JSON
for `TOO_SHORT`, duplicate sections for `TOO_LONG`).

**Check any PDF against the gate** before uploading it:

```sh
docker compose exec -T -w /app dev \
  node test-fixtures/check-compatibility.mjs test-fixtures/sample-seminar-paper.pdf
```

It parses with the app's own pdf.js configuration (legacy build + explicit
`workerSrc`), then prints per-page word/char counts and a PASS/FAIL line per
compatibility rule. Point it at a file that mysteriously produced no analysis
and it will tell you which gate rejected it.

# Scriptor

An AI thesis supervisor for university students. Upload a thesis, get a
structured review with every finding anchored to the exact words on the page.

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Supabase · OpenAI

[Live demo](https://scriptor-papercheak.vercel.app/) · [Case study](https://ahmadverse.vercel.app/work/scriptor)

![Scriptor homepage](https://ahmadverse.vercel.app/projects/scriptor/scriptor-ai-thesis-supervisor-homepage.jpg)

## What it does

A supervisor has weeks of turnaround and a hundred pages to read. Generic AI writing tools answer in seconds, but they
tell you your citations are inconsistent without ever pointing at one. Scriptor reads the whole PDF, runs a catalogue of
academic checks across it, scores the result and highlights every issue on the page it came from.

- **Academic checks:** citation style, argumentation, coherence, logical fallacies, cover page, chapter order, inclusive
  language, terminology and source density, plus grammar
- **Bibliography verification** against live academic databases
- **A prioritised revision plan** and generated viva questions drawn from the thesis's own weakest ground
- **Per-word highlights** drawn over the PDF, so every finding links to the exact words

---

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in every value
npm run dev
```

`lib/env.ts` validates the environment at boot and throws a message naming the
missing variable, so a misconfigured `.env.local` fails immediately rather than
at 2am inside a request handler.

---

## Two setup steps that fail SILENTLY if you skip them

These are the two things that will cost you an afternoon. Neither produces a
useful error.

### 1. Supabase redirect allowlist

OAuth and email sign-in both redirect to a fixed callback URL. Supabase matches
that URL against an allowlist, and an unlisted URL fails with a generic error
that looks exactly like a code bug.

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, add
both:

```
http://localhost:3000/auth/callback
https://<your-production-domain>/auth/callback
```

Note the callback lives at `/auth/callback`, deliberately **outside** the
`[locale]` segment. A locale-prefixed path would produce a different URL per
language and need three allowlist entries; `proxy.ts` excludes `/auth` from the
i18n matcher for the same reason.

### 2. Worker cron

Jobs are claimed from a Postgres queue by `POST /api/worker`. Two things drive
it:

- **`kick()`** fires immediately after a job is enqueued, so work starts in
  milliseconds instead of waiting for the next minute.
- **pg_cron in Supabase** posts to the same endpoint every minute as the safety
  net, scheduled by `supabase/migrations/21_worker_cron.sql`.

The tick is **not** a Vercel Cron entry. Vercel's Hobby plan permits one cron
run per *day* and rejects the deployment outright if `vercel.json` asks for
more, so the schedule lives in the database, where pg_cron has no such cap and
costs nothing on Supabase's free tier.

Without it, any job whose kick fails sits in the queue forever and the ingestion
page shows a stage that never completes. Set `WORKER_SECRET` in your Vercel
project environment — the route **fails closed** when it is unset, so missing it
stops job processing rather than exposing the endpoint.

```bash
openssl rand -hex 32   # generate WORKER_SECRET
```

pg_cron reads the origin and the secret from Supabase Vault at run time, so they
never enter git. Create them once in the SQL editor, then redeploy is not
needed — the schedule picks them up on the next tick:

```sql
select vault.create_secret('https://your-app.vercel.app', 'worker_url');
select vault.create_secret('<same value as WORKER_SECRET>', 'worker_secret');
```

`worker_url` is an origin with no trailing slash — the job appends
`/api/worker`. Until both exist the schedule is a deliberate no-op. Verify with
the queries at the foot of `21_worker_cron.sql`; a 401 in `net._http_response`
means the two secrets disagree.

---

## Database

The schema lives in `supabase/migrations/` as plain SQL. See
[docs/SCHEMA.md](docs/SCHEMA.md) for the table map, the aggregate boundaries,
and why `user_id` is denormalised onto child tables.

```bash
npm run db:push     # apply migrations to the linked project
npm run db:types    # regenerate lib/db/types.generated.ts
npm run db:reset    # local reset + seed
```

> **Note:** the direct database host (`db.<ref>.supabase.co`) is IPv6-only.
> From an IPv4 network use the Supavisor pooler at
> `aws-0-<region>.pooler.supabase.com` with username `postgres.<project_ref>`.

---

## Architecture rules

These are load-bearing. Breaking one tends to break something three prompts
later.

| Rule | Why |
|---|---|
| Every DB read/write goes through `lib/db/queries/*` | No inline `.from()` in components or actions — one select shape per aggregate, not sixteen |
| Every enum value comes from `lib/db/enums.ts` | Tuples are checked against the generated types with `satisfies`, so a new SQL value becomes a compile error rather than a silent gap |
| Every model call goes through `lib/ai/complete.ts` | It is the only place that writes `token_usage`. A direct SDK call spends money invisibly |
| Model IDs live only in `lib/ai/models.ts` | `check_versions.model` stores a role name, so swapping models is one edit, not an UPDATE across every historical result |
| Word coordinates are stored in PDF units + page dimensions | Storing pixels bakes in a zoom level and breaks the viewer at any other scale |
| Job handlers are idempotent | Each clears its own prior output before writing; a retry must not duplicate 50,000 word rows |
| No user-facing string outside `messages/*.json` | Including every compatibility rejection reason |

---

## Ingestion pipeline

Four stages, each an `analysis_jobs` row. Each stage enqueues the next, so they
cannot be claimed out of order by concurrent workers.

```
PARSE           → extract text + per-word geometry → paper_pages, words
IDENTIFY_PAGES  → classify each page (rules first, model for ambiguity only)
COMPATIBILITY   → deterministic verdict, no model call
→ paper_analyses row is ready; P4 owns check fan-out
```

Concurrency safety comes from `claim_analysis_jobs()`, which uses
`FOR UPDATE SKIP LOCKED` — two workers can never claim the same job.
`reap_stale_jobs()` runs every 5 minutes via `pg_cron` and returns jobs wedged
by a crashed worker.

---

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## License

[MIT](LICENSE)

## Author

Built by **Muhammad Ahmad Tahir**. [Portfolio](https://ahmadverse.vercel.app/) · [LinkedIn](https://www.linkedin.com/in/ahmad-ai-fullstack-engineer/) · [GitHub](https://github.com/ahmadtahir1399)

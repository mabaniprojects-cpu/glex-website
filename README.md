# GLEX – Global Export House

**From KSA to the World**

Corporate website and digital logistics platform connecting Saudi manufacturers and
building-material suppliers with international clients, distributors, developers,
contractors and infrastructure projects.

> **Build status:** every specified feature area is built, verified and running.
> Two are wired but unproven here because they need credentials this environment
> does not have: malware scanning (which records `not_scanned` rather than
> falsely reporting a file clean) and the chatbot's AI branch (the FAQ fallback
> is built and tested). See [`STATUS.md`](./STATUS.md) for an honest, itemised
> breakdown, including the bugs found while verifying. Read that file before
> planning work on top of this repository.

---

## Table of contents

- [Project overview](#project-overview)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
- [Database setup](#database-setup)
- [Docker setup](#docker-setup)
- [Prisma commands](#prisma-commands)
- [Seeding](#seeding)
- [Development](#development)
- [Testing](#testing)
- [Production build](#production-build)
- [Deployment](#deployment)
- [Admin account creation](#admin-account-creation)
- [Email setup](#email-setup)
- [Object storage setup](#object-storage-setup)
- [Tracking provider setup](#tracking-provider-setup)
- [Error monitoring](#error-monitoring)
- [AI setup](#ai-setup)
- [Translation workflow](#translation-workflow)
- [Content management workflow](#content-management-workflow)
- [Brand assets](#brand-assets)
- [Security notes](#security-notes)
- [Backup and restore](#backup-and-restore)
- [Troubleshooting](#troubleshooting)

---

## Project overview

GLEX is an RFQ-based export platform — **not** an instant-payment store. Clients
browse a qualified catalogue of Saudi building materials, assemble a request for
quotation, and receive a written commercial offer. GLEX coordinates sourcing,
supplier relationships, export documentation, freight and shipment visibility.

The application covers four surfaces:

| Surface | Path | Audience |
| --- | --- | --- |
| Public website | `/[locale]` | Buyers, suppliers, general public |
| Client dashboard | `/[locale]/dashboard` | Client organizations |
| Supplier dashboard | `/[locale]/supplier` | Suppliers and distributors |
| Admin portal | `/[locale]/admin` | GLEX staff |

**Company details** (real, defined once in `src/lib/company.ts`):

- Global Export House, King Road Tower, Floor 15, Offices 03 and 04,
  Ash Shati District, P.O. Box 442, Jeddah 21411, Kingdom of Saudi Arabia
- Telephone **+966 9200 31827**
- Commercial Registration **4030472336**
- Paid-up capital **SAR 1,000,000**
- Website <https://www.exporthouse.com.sa>

No email address is invented anywhere; contact delivery uses the
`CONTACT_TO_EMAIL` environment variable.

---

## Technology stack

| Concern | Choice | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack) | 16.2.12 |
| UI runtime | React | 19.2.4 |
| Language | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS | v4 |
| Icons | Lucide | — |
| Carousel | Embla | 8.x |
| Database | PostgreSQL | 17 |
| ORM | Prisma (driver adapter, query compiler) | 7.9.1 |
| Auth | Auth.js (`next-auth`) | 5.0.0-beta |
| i18n | next-intl | 4.13.4 |
| Validation | Zod + React Hook Form | 4.x / 7.x |
| Email | Resend or SMTP, via a provider abstraction | — |
| Storage | S3-compatible or local disk, via an abstraction | — |
| AI | Vercel AI SDK + Anthropic | — |
| Maps | Inline SVG (default) or MapLibre GL | — |
| Unit tests | Vitest + React Testing Library | 4.x |
| E2E tests | Playwright | 1.x |

### Version-specific notes that will bite you

Verified against the installed packages, not assumed:

1. **`middleware.ts` no longer exists.** Next 16 renamed it to `proxy.ts`
   (`src/proxy.ts`). It always runs on the Node.js runtime and that is not
   configurable.
2. **All `params` / `searchParams` are Promises.** Synchronous access was removed
   in Next 16 — always `await`.
3. **`error.tsx` receives `unstable_retry`, not `reset`.**
4. **`next lint` was removed.** Lint with `npm run lint` (`eslint .`).
5. **Prisma 7 removed `url` from the schema `datasource` block.** The CLI reads it
   from `prisma.config.ts`; the runtime client requires a **driver adapter**
   (`@prisma/adapter-pg`), wired up in `src/lib/db.ts`.
6. **`package.json#prisma` is silently ignored** in Prisma 7 — seed configuration
   lives in `prisma.config.ts` under `migrations.seed`.
7. **Auth.js JWT module augmentation must target `@auth/core/jwt`**, not
   `next-auth/jwt`. Augmenting the latter compiles but silently does nothing,
   degrading every custom claim to `unknown`. See `src/lib/auth.ts`.
8. **Do not enable `cacheComponents`** — next-intl does not support it yet.
9. **Do not add a `webpack` config** — Turbopack is the default builder and a
   webpack config makes `next build` fail.

---

## Prerequisites

- **Node.js ≥ 20.9** (developed on 24.18) — Next 16 dropped Node 18
- **npm ≥ 10**
- **PostgreSQL 17** running locally, or Docker

---

## Installation

```bash
git clone <repository-url>
cd glex-app
npm install
```

`npm install` runs `prisma generate` via `postinstall`. Prisma 7 no longer
auto-generates the client on install, so this hook is required.

> **npm 11+ blocks package install scripts by default.** Prisma's engine download
> and `sharp` both need theirs. If you see an `allow-scripts` warning:
>
> ```bash
> npm approve-scripts prisma
> npm approve-scripts @prisma/engines
> npm approve-scripts sharp
> ```
>
> The approved set is already recorded in `package.json#allowScripts`.

---

## Environment configuration

```bash
cp .env.example .env
```

Generate an auth secret:

```bash
npx auth secret          # or: openssl rand -base64 32
```

Every variable is documented inline in `.env.example` and **validated at startup**
by `src/lib/env.ts` (Zod). The app refuses to boot on an invalid configuration
rather than failing later at runtime.

Required to start:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Session signing key (≥32 chars) |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Canonical origin, used for metadata and links |
| `CONTACT_TO_EMAIL` | Destination for contact-form and internal notifications |

Everything else is optional and degrades gracefully. Cross-field rules are enforced
too — `EMAIL_PROVIDER="console"` is rejected in production, and `SEED_DEMO_DATA=true`
is rejected in production.

---

## Database setup

### Option A — local PostgreSQL

```sql
CREATE DATABASE glex;
```

```env
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/glex?schema=public"
```

### Option B — Docker

See [Docker setup](#docker-setup).

Then apply the schema:

```bash
npm run db:migrate
npm run db:seed
```

---

## Docker setup

```bash
docker compose up -d                          # PostgreSQL only
docker compose --profile storage up -d        # + MinIO (S3-compatible)
```

| Service | Port | Notes |
| --- | --- | --- |
| PostgreSQL 17 | 5432 | volume `glex-postgres-data` |
| MinIO API | 9000 | optional, `storage` profile |
| MinIO console | 9001 | optional |

The application itself runs on the host with `npm run dev`.

---

## Prisma commands

| Command | Purpose |
| --- | --- |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:reset` | Drop, recreate and re-migrate — **destroys data** |
| `npm run db:seed` | Run the seed script |
| `npm run db:studio` | Open Prisma Studio |
| `npx prisma generate` | Regenerate the client |
| `npx prisma validate` | Validate the schema |

> Prisma 7 removed `--skip-generate` and `--skip-seed` from `migrate dev` and
> `migrate reset`, contrary to some published documentation.

---

## Seeding

```bash
npm run db:seed
```

**Always seeded (production-safe reference data):** Jeddah office, 10 indicative
global trade routes, 20 product categories, 8 FAQ entries, 20 email templates.

**Demo data** — created only when `SEED_DEMO_DATA=true` *and*
`NODE_ENV !== production`. Every record is flagged `isDemo` / `isSample` so it can
be filtered or deleted from the admin portal.

`SEED_DEMO_PASSWORD` has **no default** and demo seeding refuses to run without
it. A default would be the same password on every environment that seeded
without setting one — including staging and preview deployments, which are not
production — and this repository is public, so it would be a published
credential for a `SUPER_ADMIN` account. Choose your own: 10+ characters with a
letter and a digit.

| Account | Role | Password |
| --- | --- | --- |
| `admin@glex.demo` | Super Admin | whatever you set `SEED_DEMO_PASSWORD` to |
| `client@glex.demo` | Client org admin | same |
| `supplier@glex.demo` | Approved supplier | same |
| `pending-supplier@glex.demo` | Pending supplier | same |

Also seeded: a client organization, an approved and a pending supplier, 6 sample
products, 1 sample RFQ, 1 demonstration shipment with a 7-event timeline, 3 sample
news articles, and an announcement.

> **Demo credentials are for local development only and can never be created in
> production** — `src/lib/env.ts` throws if `SEED_DEMO_DATA` is enabled while
> `NODE_ENV=production`.

---

## Development

```bash
npm run dev          # http://localhost:3000 → redirects to /en
```

On Windows, if `node` is not on the shell `PATH`, use the wrapper, which also sets
the correct working directory:

```cmd
scripts\dev.cmd
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate && next build` |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run format` | Prettier |
| `npm run brand:assets` | Regenerate logo variants from the source artwork |

---

## Testing

```bash
npm test             # Vitest unit tests
npm run test:e2e     # Playwright (needs a running dev server)
```

First Playwright run:

```bash
npx playwright install chromium
```

Both suites, plus the locale and encoding scanners, run in CI — see
[Continuous integration](#continuous-integration).

---

## Production build

```bash
npm run build
npm start
```

The build runs `prisma generate` first, because Prisma 7 has no install-time
generation hook.

### Continuous integration

`.github/workflows/ci.yml` runs every check in this README. On a pull request:
types, lint, unit tests, locale parity, the encoding scan, a production build
and a dependency audit, plus the E2E suite against a dev server with PostgreSQL
as a service container. On a push to `main` it runs the E2E suite against a
**production build** instead, with a maildev sidecar standing in for SMTP.

The audit step fails on `critical` only. Four `high` advisories in the
`nodemailer` → `@auth/core` → `next-auth` chain have no published fix and the
affected `raw` option is never used here; a gate that is always red is a gate
everyone learns to ignore. Revisit when upstream ships.

The workflow has not been executed — this working copy is not a git repository
and has no remote. Every command inside it has been run locally and passes.

### Verifying a production build

The E2E suite normally runs against `next dev`, so a release candidate should be
exercised against a real production server at least once — Auth.js has a
reported issue with custom login pages under production Turbopack builds
([nextauthjs/next-auth#13353](https://github.com/nextauthjs/next-auth/issues/13353)),
and sign-in gates every authenticated surface.

`src/lib/env.ts` refuses `EMAIL_PROVIDER=console` under `NODE_ENV=production`,
so point the SMTP provider at a local sink. `SEED_DEMO_DATA` is a seed-time
flag, not a runtime one — a database seeded earlier keeps its demo accounts.

```bash
npx maildev --smtp 1025 --web 1080
```

Then, with those variables set for both commands (they take precedence over
`.env`):

```bash
EMAIL_PROVIDER=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SEED_DEMO_DATA=false npm run build
```

Start it the same way, then run `npx playwright test` — the config reuses a
server already listening on the port instead of starting `next dev`. All 353
tests pass against a production build, in roughly a third of the dev-server time.

Two log lines are expected during that run: `CredentialsSignin` from the tests
that assert a bad password is refused, and *"The destination stream closed
early"* whenever Playwright navigates away mid-stream.

---

## Deployment

1. Provision PostgreSQL 17 and set `DATABASE_URL`.
2. Set every required environment variable. `NODE_ENV=production` activates the
   stricter validation rules in `src/lib/env.ts`.
3. Run migrations: `npm run db:deploy`.
4. Seed reference data only: leave `SEED_DEMO_DATA` unset, then `npm run db:seed`.
5. Build and start: `npm run build && npm start`, or use the standalone
   artifact below for a container.
6. Terminate TLS at the load balancer. `Strict-Transport-Security` and the CSP are
   already emitted from `next.config.ts`.
7. Create the first real administrator (below) and delete any demo accounts.

### Standalone artifact

`next.config.ts` sets `output: 'standalone'`, so the build also emits
`.next/standalone` — a server carrying only the traced subset of `node_modules`,
with no install step. `next start` still works; this is additional output.

```bash
npm run build
npm run package:standalone
npm run start:standalone
```

**The packaging step is not optional.** It does two things the build leaves
undone, both of which fail quietly:

- `server.js` does not serve `public/` or `.next/static` unless they are copied
  in. Without it the site boots and answers 200 while every stylesheet, script,
  font and image 404s — which reads as a broken CDN, not a missing build step.
- Next copies `.env` and `.env.production` into `.next/standalone`
  **unconditionally**, outside the file-tracing system, so
  `outputFileTracingExcludes` cannot prevent it. On a machine with a real `.env`
  that writes `AUTH_SECRET`, the database password and the SMTP password into
  the deployment artifact. The script removes them.

Configuration must come from the platform's environment, never from a file baked
into an image. A build in CI has no `.env` on disk and nothing is copied there in
the first place — the script is the safety net for every other case.

`storage/`, `e2e/` and the test-output directories are excluded from tracing in
`next.config.ts`; the first standalone build here copied all 15 uploaded customer
documents into the artifact before that was added.

The whole E2E suite passes against this artifact, not only against `next start`.

**Platform notes**

- Node ≥ 20.9 is required.
- `src/proxy.ts` requires the Node.js runtime — it cannot run on an edge runtime.
- Persist or externalise uploads: the `local` storage provider writes to `./storage`,
  which is ephemeral on most container platforms. Use `STORAGE_PROVIDER=s3` in
  production.
- **Health probes.** Point the load balancer's liveness check and the restart
  policy at `GET /api/health`, which answers 200 as long as the process can serve
  HTTP and deliberately touches nothing else. Point traffic gating during a
  rolling deploy at `GET /api/health/ready`, which returns 503 when the database
  is unreachable. **Do not wire readiness to a restart policy** — restarting the
  app cannot fix a database that is down, and doing so turns a recoverable
  outage into a crash loop. Both are unauthenticated and report only pass or
  fail; reasons go to the server log.
- **No cron is required.** The `RateLimit` and `SecurityToken` tables are pruned by
  `src/lib/maintenance.ts`, driven by ordinary traffic through `after()` and
  capped at one sweep per hour per instance. Call `runMaintenance()` directly if
  you would rather schedule it. It logs a line whenever it deletes anything.
- Known upstream issue: Auth.js custom login pages have reported problems under
  production Turbopack builds (nextauthjs/next-auth#13353). Verify sign-in against a
  production build before release.

---

## Admin account creation

Demo accounts must never exist in production. Promote an existing, email-verified
user:

```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'you@example.com';
```

Roles are defined by the `UserRole` enum and the permission matrix in
`src/lib/rbac.ts`.

---

## Email setup

`EMAIL_PROVIDER` selects the transport:

| Value | Behaviour |
| --- | --- |
| `console` | Prints the message to the terminal, sends nothing. Development default. **Rejected in production.** |
| `smtp` | Requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| `resend` | Requires `RESEND_API_KEY` |

Templates are seeded into the `EmailTemplate` table (keyed by `key` + `locale`) and
are editable from the admin portal.

---

## Object storage setup

| `STORAGE_PROVIDER` | Behaviour |
| --- | --- |
| `local` | Writes to `./storage` (gitignored). Development only. |
| `s3` | Any S3-compatible endpoint. Requires `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; set `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true` for MinIO. |

`UPLOAD_MAX_MB` caps upload size. Uploads are recorded in the `StoredFile` model,
which carries `scannedAt` / `scanResult` columns for a malware-scanning integration.

---

## Tracking provider setup

Shipment tracking is built around a provider interface:

```ts
interface TrackingProvider {
  track(input: TrackingInput): Promise<NormalizedTrackingResult>
  validateWebhook(request: Request): Promise<boolean>
  processWebhook(payload: unknown): Promise<void>
}
```

| `TRACKING_PROVIDER` | Behaviour |
| --- | --- |
| `internal` | GLEX logistics staff maintain shipments and events by hand. **Production-safe default.** |
| `mock` | Seeded demonstration data. The UI shows a prominent *Demo Tracking Mode* banner. Development only. |
| *(external name)* | An adapter, enabled only when `TRACKING_API_KEY` is also set. |

Webhooks post to `/api/webhooks/tracking` and are verified against
`TRACKING_WEBHOOK_SECRET` (HMAC-SHA256 over the raw body, compared in constant
time, in the `x-glex-signature` header). Ingestion lives in
`src/lib/tracking/ingest.ts` and is unit-tested; the route handler is a thin
shell around it.

Behaviour worth knowing before integrating:

- **No secret configured means every webhook is refused.** A deployment that
  forgets to set one is closed, not open.
- **Replays are free.** Duplicate events are absorbed by the unique
  `ShipmentEvent(shipmentId, dedupeKey)` constraint via `skipDuplicates`, so two
  simultaneous deliveries of the same event cannot both win.
- **A payload naming an unknown shipment returns 202, not 404.** A carrier
  cannot create shipments, and the endpoint does not report which references
  exist.
- **Out-of-order delivery is safe.** Only the newest event by `occurredAt`
  decides the shipment status, so a late-arriving old milestone cannot roll a
  delivered shipment back.

**The application never presents mock or seeded data as live carrier data.**
`isExternalTrackingConfigured()` in `src/lib/env.ts` is the single source of truth
for whether live tracking is available.

To add a carrier adapter: implement `TrackingProvider`, register it in the tracking
registry, map carrier statuses onto the `ShipmentStatus` enum in the normalizer, and
set the three `TRACKING_*` variables.

---

## Error monitoring

Sentry, optional like every other integration here: with no DSN nothing is
initialised and nothing is sent anywhere.

```bash
SENTRY_DSN="https://…@…ingest.sentry.io/…"             # server
NEXT_PUBLIC_SENTRY_DSN="https://…@…ingest.sentry.io/…" # browser, consent-gated
```

**The two halves are governed differently, on purpose.**

The server DSN reports faults in GLEX's own software from GLEX's own machines —
the same category as a server log — and is always active. `sendDefaultPii` is
off, so no IP addresses, cookies or headers are attached.

The browser DSN is gated on cookie consent. That SDK sees the visitor, so it is
never initialised unless they chose "accept all"; it is not initialised and then
suppressed. The honest cost: visitors who have not chosen contribute no browser
error reports, and accepting takes effect from their next page load. Server-side
reporting is unaffected and still catches the majority of what breaks.

Navigation interrupts (`notFound()`, `redirect()`, `forbidden()`,
`unauthorized()`) and client disconnects are filtered out in
`src/lib/monitoring.ts`. They are control flow and network facts, not faults,
and reporting them would bury real errors — one end-to-end run produces 22
disconnects alone.

Session Replay is deliberately not enabled. It records what a visitor sees and
types, which is a far larger collection than "an error happened".

The existing CSP already permits any `https:` connect target, so a real Sentry
DSN needs no policy change. An `http://` DSN — a local stub, say — is blocked.

For readable production stack traces, add the build-time trio; without all three
the upload step is skipped and the build still succeeds:

```bash
SENTRY_ORG="…"
SENTRY_PROJECT="…"
SENTRY_AUTH_TOKEN="…"   # secret
```

Uploaded maps are deleted from the build output afterwards, so the application's
source is not published to the CDN.

---

## AI setup

The **GLEX Assistant** chatbot uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`
(default `claude-sonnet-5`) through a provider abstraction.

**The application builds and runs with no API key set.** Without a key the assistant
falls back to deterministic search over the `FaqEntry` and `KnowledgeDocument`
tables and tells the user it is doing so. Fallback answers are returned verbatim
from the matched entry, with its title shown, so the assistant cannot generate a
price, a date or a requirement even when it matches the wrong question.

| Surface | Path |
| --- | --- |
| Widget | `src/components/chat/glex-assistant.tsx`, mounted once in `src/app/[locale]/layout.tsx` |
| Turn endpoint | `POST /api/chat` |
| Feedback | `POST /api/chat/feedback` |
| Human handoff | `POST /api/chat/handoff` |
| Guardrails / tools / fallback | `src/lib/ai/` |
| Conversation ownership | `src/lib/chat.ts` |

Assistant safety rules:

- Authorization is checked server-side before any private lookup; a user can only
  ever see their own RFQs, shipments, documents and tickets. Private tools are not
  registered at all for an anonymous visitor, so no prompt can reach account data.
- Conversations are owned by an account or by an opaque httpOnly visitor cookie.
  Every read and write is scoped by that ownership, so a guessed conversation id
  cannot append to, rate, or escalate someone else's transcript.
- Requests are rate-limited: `CHAT_RATE_LIMIT` messages per 15 minutes (default 30),
  keyed by account when signed in and by IP otherwise. Raise it where many genuine
  visitors share one address.
- Tool *names* are logged; arguments and retrieved private content are not.
- Escalation creates a real support ticket only for a signed-in person. An anonymous
  visitor is directed to the contact form instead — there is no way to reply to them,
  and promising a follow-up would be a commitment the system cannot keep.
- The assistant must not make binding commercial commitments, nor invent prices,
  shipping dates, legal requirements or shipment statuses.

---

## Translation workflow

Five languages: **en, ar, de, fr, zh-CN**. Arabic renders full right-to-left.

- Message catalogues live in `messages/<locale>.json`.
- `messages/en.json` is the source of truth (861 keys).
- `global.ts` augments next-intl's `AppConfig`, so **every `t()` key is type-checked
  at compile time** against the English catalogue. A typo is a build error.
- `src/i18n/request.ts` merges English underneath the active locale, so a key that
  has not been translated yet renders English rather than a raw key path.
- A unit test asserts that all five files share an identical recursive key set with
  matching ICU placeholders.

To add a string: add it to `messages/en.json`, then to all four other files, keeping
the key order identical.

**UI strings are deliberately not admin-editable.** They are read from these JSON
files at build time, so a runtime editor would have to write to the repository —
which fails on any read-only or replicated deployment, skips review of
customer-facing copy, and defeats the parity check above. The `translation:write`
permission exists for the database-backed copy below, not for these files.

Database-backed copy that *is* per-locale and editable in the portal: email
templates (`/admin/emails`), FAQ entries (`/admin/faq`) and announcements
(`/admin/settings`).

Products and news articles are translated in the portal, on their own edit pages:
choose a language, fill the fields, save. The English source is shown beside each
field so nobody translates from memory.

- **English is the source, not a translation.** The base record holds it, and
  `pickTranslation()` falls back to it. Only the four other locales are offered —
  an `en` translation row would shadow the source and the two could disagree.
- **Removing a translation is safe.** The page falls back to English rather than
  rendering an empty title.
- **A required field cannot be saved blank**, because the fallback only triggers
  on a missing row, not on an empty string.

Categories and news categories have the same `*Translation` tables and are
handled by the same editor, but are not mounted on their admin pages yet; see
[`STATUS.md`](./STATUS.md).

**Locale mapping caveat:** the URL/BCP-47 form is `zh-CN`, but Prisma enum members
cannot contain a hyphen, so the database stores `zh_CN`. Always cross that boundary
with `toDbLocale()` / `fromDbLocale()` from `src/i18n/locale.ts`.

---

## Content management workflow

**Editable from the admin portal today**, no deploy required:

| Content | Where |
| --- | --- |
| Product categories | `/admin/categories` — create, edit, re-order, activate; a category with products or sub-categories cannot be deleted |
| Products | `/admin/products` — create, edit, publish/hide, soft-delete, search |
| News articles | `/admin/news` — write, schedule, publish, soft-delete, search. A future publication date keeps the article hidden until it arrives; no cron job is involved |
| RFQ status, assignment, internal notes | `/admin/rfqs` |
| Supplier applications | `/admin/suppliers` |
| Announcement bar | `/admin/settings` — one active announcement at a time, with an optional schedule |
| Social links | `/admin/settings` — rendered in the footer; http(s) only |
| FAQ entries | `/admin/faq` — also the source the GLEX Assistant quotes when no AI provider is configured |
| Staff and client accounts | `/admin/users` — change a role, deactivate or reactivate, clear a brute-force lockout. Nobody can alter their own account, grant a role above their own, or switch off the last administrator |
| Client and supplier organizations | `/admin/organizations` — edit details, enable or disable. **Disabling denies a session to every member**, so it ends a whole company's access at once. An organization holding users, RFQs or shipments cannot be deleted |
| Office locations | `/admin/offices` — drives the addresses on the public contact page. Exactly one head office; the last office cannot be deleted |
| News categories | `/admin/news/categories` — slug derived from the name. A category holding articles cannot be deleted |
| Email copy | `/admin/emails` — subject, heading and body per template and locale. Only keys the code actually sends can be chosen. Deleting a row degrades to English and then to built-in copy, so mail never stops |
| Chat transcripts | `/admin/chats` — read-only record of what the GLEX Assistant told visitors, with an escalated-only filter |
| Trade routes | `/admin/routes` — the lanes drawn on the homepage map and network page |

Every mutation writes an `AuditLog` row in the same transaction as the change.
Slugs are derived server-side from the name and are never accepted from the client.
There is deliberately **no price field** — the catalogue is quotation-based.

**Modelled in the schema and seeded, but with no admin UI yet:** office business
hours · chatbot knowledge documents · the per-entity translation tables
(`ProductTranslation`, `NewsTranslation`, …). These are edited directly in the
database for now. UI strings live in `messages/*.json` and are deliberately not
admin-editable — see [`STATUS.md`](./STATUS.md) for why.

Seeded demonstration content is flagged `isDemo` / `isSample` and is safe to delete.

---

## Brand assets

The official logo is the single source of truth and is **never** redrawn, recoloured,
stretched or distorted. `scripts/build-brand-assets.mjs` derives every variant from
it — each output is a lossless trim, a proportional resize, or the untouched logo
composited onto a solid brand-palette plate.

```bash
npm run brand:assets
```

Outputs to `public/brand/`: `glex-logo.png` (canonical), navigation, mobile and
footer lockups at 1× and 2×, a dark-background plate, favicons (16/32/48), PWA icons
(192/512), an Apple touch icon, and a 1200×630 Open Graph image.

The source path is overridable with `GLEX_LOGO_SOURCE`.

**Palette** (from the logo, defined in `src/app/globals.css`):

| Token | Hex | Use |
| --- | --- | --- |
| Primary deep green | `#017A4D` | Main corporate colour |
| Secondary green | `#479774` | Cards, secondary sections |
| Light mint | `#94C4AF` | Data visualisation, filters |
| GLEX gold | `#DFBE52` | Premium accent, primary CTAs only |
| Warm ivory | `#E7EAD6` | Backgrounds |
| Dark text | `#0F2B22` | Body copy |

The deep green fails contrast on dark surfaces, so the dark-background lockup places
the untouched logo on an ivory plate rather than recolouring the mark.

---

## Security notes

Implemented:

- bcrypt password hashing (cost 12); one strength policy shared by the Zod schemas
  and the seed script
- Account lockout after 5 failed logins for 15 minutes; staff can clear one from `/admin/users`
- Email verification required before a session is issued
- HTTP-only, `SameSite` session cookies (Auth.js)
- Content Security Policy, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` — all in `next.config.ts`
- Role-based access control with an explicit, non-hierarchical permission matrix
  (`src/lib/rbac.ts`). `canAssignRole()` enforces containment — an administrator
  can never grant a role holding a permission they lack, so the matrix cannot be
  escalated around
- JWT sessions are re-validated against the database at most 60 seconds after a
  change (`REVALIDATE_AFTER_MS` in `src/lib/auth.ts`), so deactivating an account,
  demoting a role or disabling an organization takes effect promptly instead of
  waiting out the 30-day token
- A disabled or deleted organization denies a session to every one of its
  members, at sign-in and on revalidation
- Server-side guards (`src/lib/auth-guards.ts`) for every privileged entry point
- Organization-level data isolation applied **in SQL**, via `organizationScope()`
- Audit logging with sensitive-field masking (`mask()` in `src/lib/utils.ts`)
- Environment-variable validation at startup
- Durable rate limiting (`RateLimit` model)
- Honeypot fields that accept-and-drop rather than reject. The Zod schemas are
  deliberately permissive about them: a validation error naming the field would
  tell a bot exactly which one is the trap
- Webhook signature verification
- SQL-injection protection through Prisma's parameterised queries
- Soft deletion on user-facing content so history survives admin actions
- Cookie consent read **on the server** (`isAnalyticsAllowed()` in
  `src/lib/consent.ts`), so a script requiring consent is never sent to the
  browser at all rather than sent and suppressed. Refusals are recorded as
  `ConsentRecord` evidence alongside grants, and the choice can be withdrawn
  from the cookie policy page as easily as it was given

**Critical rule:** `src/proxy.ts` performs an *optimistic* cookie check to improve
redirect UX. It is **not** a security boundary — Server Actions POST to the page's
own URL and route handlers can be called directly. Every privileged page, server
action and route handler must call a guard from `src/lib/auth-guards.ts`.

Nothing is hard-coded: API keys, database passwords, email credentials, tracking
credentials and AI credentials all come from environment variables.

---

## Backup and restore

```bash
# Backup
pg_dump --format=custom --file=glex-$(date +%F).dump "$DATABASE_URL"

# Restore
createdb glex_restore
pg_restore --dbname="postgresql://…/glex_restore" --clean --if-exists glex-2026-01-01.dump
```

Also back up the object store (the `S3_BUCKET`, or `./storage` for the local
provider) — database rows reference files by key, so a database-only restore leaves
broken document links.

Recommended: nightly `pg_dump` with 30-day retention, bucket versioning enabled, and
a quarterly restore rehearsal into a scratch database. Migrations are committed under
`prisma/migrations`, so schema history is reproducible from the repository.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `The datasource property 'url' is no longer supported` | Prisma 7. The URL belongs in `prisma.config.ts`, not `schema.prisma`. |
| `PrismaClient ... A driver adapter is required` | Prisma 7 needs `@prisma/adapter-pg`. Use the singleton in `src/lib/db.ts`. |
| `No seed command configured` | Prisma 7 ignores `package.json#prisma`. Configure `migrations.seed` in `prisma.config.ts`. |
| Custom JWT claims are `unknown` | The augmentation must target `@auth/core/jwt`, not `next-auth/jwt`. |
| `Could not find i18n config at ./src/i18n/request.ts` | The dev server was started from the wrong working directory. Use `scripts\dev.cmd`, or `cd` into `glex-app` first. |
| `'node' is not recognized` | Node is not on the shell `PATH`. Prepend `C:\Program Files\nodejs`, or use `scripts\dev.cmd`. |
| `npm warn allow-scripts` and Prisma fails | npm 11 blocked the engine download. Run `npm approve-scripts prisma @prisma/engines sharp`. |
| `next build` fails mentioning webpack | Turbopack is the default builder in Next 16. Remove any `webpack` config. |
| Images 400 with a quality error | Next 16 only allows qualities listed in `images.qualities`. |
| Build fails on a parallel route | Next 16 requires an explicit `default.tsx` for every `@slot`. |

---

## Licence and ownership

Proprietary. © Global Export House. The GLEX name, logo and brand assets are the
property of Global Export House.

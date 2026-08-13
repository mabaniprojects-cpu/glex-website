# Build status

Honest, itemised state of the GLEX platform against the original specification.
Everything marked **Done** was verified by running it — not by inspection.

**Last verification run — all green:**

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean |
| `npx vitest run` | **132 passed** (13 files) |
| `npx playwright test` | **337 passed**, zero flakes (13 server-behaviour specs run once on desktop, not twice) |
| `npx next build` | 87 routes × 5 locales |
| `node scripts/verify-locales.mjs` | 861 keys × 5 locales, identical |
| `node scripts/check-encoding.mjs` | 265 files, no BOM or mojibake |

---

## Verified working

| Area | Evidence |
| --- | --- |
| Toolchain | Node 24.18.0, npm 11.16.0, PostgreSQL 17.10 installed and running |
| Next.js 16.2.12 + React 19.2.4 + Tailwind v4 + TS strict | production build succeeds |
| Database schema | 63 tables, 19 enums, migrations `init` + `freight_inquiry` applied |
| Prisma 7 runtime | driver adapter connects; queries return |
| Seed data | reference + demo data committed to PostgreSQL |
| Brand assets | 15 variants derived from the official logo, visually verified |
| Five locales | 861 keys each, key/placeholder parity enforced by a unit test |
| Arabic RTL | `dir="rtl"` + `lang="ar"` asserted by E2E; content genuinely translated |
| **Contact form → database** | E2E submits, DB row verified: `GLEX-INQ-2026-000001` + consent record |
| **Shipment tracking** | E2E resolves seeded `GLEX-SHP-2026-000001`, 7-event timeline, demo banner |
| **Client registration → sign-in** | E2E: register → user/org/profile rows → verify by token → sign in |
| **Password reset** | E2E: token issued, password changed, sessions cleared, token single-use |
| **Password + token hashing** | E2E asserts bcrypt `$2b$` hash and SHA-256 token; no clear text stored |
| **Account enumeration resistance** | E2E: reset never reveals whether an address is registered |
| **Rate limiting** | Unit-tested against the real database: burst, isolation, expiry, pruning |
| Email transport | console / SMTP / Resend abstraction; branded RTL-aware templates |
| **Marketplace** | E2E: search, category filter, sort, pagination, empty state, 6 seeded products |
| **No price is ever shown** | E2E asserts no currency symbol or SAR/USD amount anywhere in the catalogue |
| **Product detail** | E2E: specifications table, downloads, related products, Product JSON-LD **without** a fabricated `offers` block |
| **RFQ cart** | E2E: add-to-cart persists in an httpOnly cookie; server re-validates every line against the database |
| **RFQ submission → database** | E2E asserts the PostgreSQL row: status, guest flag, items, quantities, destination, activity record, verification token |
| **RFQ references** | Sequential and transactional — `GLEX-RFQ-2026-000003…000007` issued across the test run |
| **RFQ confirmation privacy** | E2E asserts a reference alone does **not** leak the project name or line items |
| Public pages | home, about, services, network, resources, FAQ, tracking, contact, 4 legal |
| Auth pages | login, register chooser, client register, forgot/reset password, verify email |
| Catalogue pages | marketplace, category, product detail |
| RFQ pages | builder (`/rfq`) and confirmation (`/rfq/[reference]`) |
| **Client dashboard** | overview, RFQ list + detail, shipments, saved products, notifications, security |
| **Admin portal** | overview metrics, RFQ management + assignment, supplier approval workflow, shipments, inquiries, audit log |
| **Admin authorization** | E2E: signed-out, client and supplier accounts are all refused every admin route |
| **Every admin mutation is audited** | E2E asserts the `AuditLog` row, the `RFQActivity` row and the `isInternal` note, written in one transaction |
| **Supplier approval promotes users** | E2E: approving a supplier flips its users to `APPROVED_SUPPLIER` and records the reviewer |
| **Audit redaction** | E2E asserts no email address appears in the audit view; sensitive fields are masked at write time |
| **Supplier portal** | profile with completion indicator, assigned opportunities, own catalogue, security |
| **Sourcing-opportunity isolation** | E2E: with one opportunity assigned to each of two suppliers, neither reference, line item nor message from the other is present anywhere in the page |
| **Client identity withheld from suppliers** | E2E asserts the requesting client's project name never reaches the supplier view |
| **File storage abstraction** | local + S3 providers; type determined by **magic-number sniffing**, not the declared MIME |
| **Authorized downloads** | `/api/files/[id]` returns 404 — not 403 — to an unauthorized caller, so ids cannot be probed |
| **News CMS** | listing with category filter + search + pagination, article pages, related articles, social sharing, per-locale RSS |
| **Scheduled publishing** | E2E: an article dated in the future is absent from the listing, its own route **and** the RSS feed, then appears once its date passes |
| **Drafts are unreachable** | E2E asserts a `DRAFT` article 404s even with a past publication date |
| **Homepage news slider** | Embla carousel with `aria-roledescription`, a live region, keyboard arrows and a pause control |
| **Reduced motion respected** | E2E: with `prefers-reduced-motion: reduce`, autoplay never starts (WCAG 2.2 Pause, Stop, Hide) |
| **Supplier registration** | 6-step form with save-and-continue, document upload, and a computed completion percentage |
| **No banking details requested** | E2E walks all six steps and asserts no IBAN/SWIFT/account field exists anywhere |
| **Supplier application → database** | E2E asserts organization, profile, categories, Incoterms, contacts, `PENDING_SUPPLIER` user and verification token |
| **Registration resists enumeration** | E2E: submitting an already-registered address returns the same success panel and creates nothing |
| **Organization data isolation** | E2E: a client opening another organization's RFQ gets a plain 404, and it never appears in their list |
| **Route protection** | E2E: every `/dashboard/*` route redirects a signed-out visitor to `/login` with `callbackUrl` preserved |
| **No raw identifiers leaked** | E2E asserts no UUID appears on the security page |
| **User administration** | E2E: role change, deactivation and lockout clearing, each stored and audited. No password hash reaches the page |
| **No privilege escalation** | Unit-tested exhaustively across every ordered pair of roles: an actor can never grant a role holding a permission they lack. An ADMIN cannot mint a SUPER_ADMIN |
| **You cannot act on your own account** | E2E: the signed-in administrator’s own row is read-only, and the action refuses it server-side — no self-escalation, no self-lockout |
| **The last administrator is protected** | Deactivating the final active admin is refused; recovering from it would need direct database access |
| **Revocation actually revokes** | Deactivation clears the account’s sessions, and the JWT is re-read against the database at most a minute later. Previously the token carried its role unchecked for its full 30-day life, so deactivating a user changed nothing |
| **Support tickets** | E2E: a requester reads and answers their own ticket; an internal staff note is absent from their page entirely; another owner’s reference is a plain 404; a staff reply reaches the requester; status changes are audited. These tickets were already being created by the assistant handoff with nowhere to read them |
| **Per-entity translations** | E2E: an Arabic product name written in the portal is what `/ar/products/[slug]` renders, while `/en` is untouched. Removing it falls back to the English source rather than emptying the page |
| **English is never a translation row** | The base record is the English source and `pickTranslation()` falls back to it, so an `en` row would shadow it and the two could disagree. E2E asserts only four locale tabs are offered |
| **A blank translation cannot be saved** | `?? product.name` does not fall back on an empty string, so a blank name would render as nothing. The save control is disabled and the action refuses it |
| **Freight quote form** | E2E: the freight detail is stored as typed columns (mode, Incoterm, lane, weight, volume, container) rather than prose, reusing the contact pipeline for its reference, consent record, rate limit and honeypot |
| **Dangerous goods are declared, never inferred** | E2E: the flag defaults to false and is stored exactly as ticked; it is surfaced in the internal notification rather than left to be discovered |
| **The freight schema is idempotent** | Unit-tested: `zodResolver` transforms on the client and the Server Action re-parses the result, so parsing its own output must succeed. It did not, and every submission leaving a number blank failed with a generic error |
| **Two-way RFQ conversation** | E2E: a client reply is stored client-visible and recorded in the activity trail; an internal staff note is absent from the client page markup entirely; a client posting on another organization RFQ gets a plain 404 and writes nothing |
| **Quotation workflow** | E2E: staff issue an offer with a sequential `GLEX-QUO-` reference, audited; the client accepts and the RFQ moves to ACCEPTED; an already-answered quotation shows its outcome instead of controls that would overwrite it |
| **A closed request takes no replies** | E2E: no form is rendered at all, rather than one the server would refuse |
| **Carrier webhook** | 15 unit tests: replays absorbed by the unique constraint via `skipDuplicates`; an unknown shipment is accepted and dropped rather than created; a late-arriving old milestone cannot roll a delivered shipment back; a tampered body cannot keep its signature |
| **Client documents, team and organization** | Read-only dashboard pages scoped by the session own `organizationId` — no id in the URL to tamper with |
| **Email template management** | E2E: copy edited and audited; the key select offers only template keys the code actually sends, so no unreachable copy can be authored; the unique key+locale pair is enforced |
| **A deactivated translation is skipped, not promoted** | Unit-tested. The exact-locale lookup previously ignored `isActive`, so switching a translated template OFF started it being used — the toggle did the opposite of its label |
| **Mail survives an empty template table** | E2E: with the `contact-received` row deleted, a contact enquiry still submits and returns its reference. Resolution degrades locale → English → hard-coded copy |
| **Chat transcripts** | E2E: a conversation reads end to end with tool names but never tool arguments; the escalated filter works; an unknown id is a plain 404 |
| **Transcripts are read-only and do not re-identify** | E2E asserts no edit control, no textarea, and that the anonymous visitor cookie id never reaches the markup or the RSC payload |
| **Office management drives the public site** | E2E: an office added in the portal appears on `/en/contact` with its address. The `Office` table was previously read nowhere — every address came from a hard-coded constant, so the form would have edited nothing |
| **Exactly one head office** | Promoting one demotes the rest, so ordering by `isPrimary` has a single answer. Unit-tested alongside the refusal to delete the last office |
| **An empty coordinate is unmapped, not zero** | Unit-tested: `''` must not coerce to 0, which would drop a pin in the Gulf of Guinea and look like real data |
| **News categories** | E2E: created with a server-derived slug and audited; a category holding articles cannot be deleted (the relation is `SetNull`, so a delete would quietly strip their category); an empty category stays off the public news page |
| **Organization administration** | E2E: details edited and audited; a `javascript:` website is refused server-side and nothing is stored |
| **Disabling an organization really ends access** | E2E signs a member in, disables their organization from the portal, and proves the same credentials are then refused. `Organization.isActive` was previously read nowhere, so the switch would have been decorative |
| **Commercial history is never orphaned** | An organization holding users, RFQs or shipments cannot be deleted — the control is not even offered — and deletion is soft when it is allowed |
| **Contact enquiries reach a human** | Unit-tested: a submission acknowledges the sender **and** notifies `CONTACT_TO_EMAIL` with the reference and a portal link. It was previously stored and announced to nobody |
| **Honeypots actually trap** | E2E: a filled honeypot on the live contact form returns the ordinary success panel and writes **no** database row. The schemas no longer reject it — a validation error naming the field would tell a bot which one is the trap |
| **Cookie consent** | E2E: the banner appears once for a new visitor, both choices are equally prominent, the decision is read server-side so it never returns, and a **refusal is stored as evidence** just like a grant. Withdrawable from the cookie policy page |
| **Nothing optional loads before consent** | The choice is read on the server, so a script requiring consent is never sent to the browser rather than sent and suppressed (spec §31) |
| **Announcement bar** | E2E: an active announcement renders above the header site-wide and disappears when deactivated; a `javascript:` link is refused server-side and nothing is written |
| **FAQ management** | E2E: a new entry reaches the public FAQ page **and** the GLEX Assistant answers from it verbatim — the fallback cites it as its source |
| **Social links and trade routes** | E2E: a route is stored with its decimal-degree coordinates; social links render in the footer. Both http(s)-only |
| **News authoring** | E2E: draft → PostgreSQL row with a derived slug, server-computed reading time and `isSample: false`, unreachable by its own slug; publish → live article + `AuditLog`; delete → soft delete that removes the public page |
| **Scheduled publishing is honest** | E2E: a future publication date keeps the article out of the listing, its own page **and** the RSS feed; the editor says plainly whether saving makes it public |
| **Publication times are company time** | Unit-tested round trip: the editor reads and writes `Asia/Riyadh` wall-clock time, so a server running in UTC cannot shift a scheduled post by three hours |
| **Going live is a script, not a hand-typed UPDATE** | `scripts/promote-admin.mts` and `scripts/purge-demo-data.mts`, both dry-run by default. Exercised for real against the development database: every refusal path (missing account, unverified, deactivated, already promoted, no real administrator) and the destructive path, after which the demo accounts were confirmed gone, the audit rows written, and the database re-seeded and the full suite re-run |
| **The purge cannot lock you out** | It refuses while the only `SUPER_ADMIN` is a demo account — verified by running it in exactly that state — so the accounts cannot be removed before a real administrator exists |
| **The deployable artifact is the thing that was tested** | All 365 E2E tests pass against `.next/standalone` started with `node server.js`, not only against `next start` — so the traced dependency subset, the Prisma driver adapter and the copied static assets are all exercised as they will be in a container. 3.2 min, no flaky |
| **The artifact carries no secrets and no customer files** | Verified by listing it: `.env` and `storage/` are both absent after `npm run package:standalone`. Before that work they were both present — see bug 21 |
| **Errors actually reach the monitor** | Verified against a stand-in ingest endpoint, not by inspection: a real Prisma connection failure inside a Server Component was transmitted with its type and message, and a genuine browser error was too. Unit-tested that navigation interrupts and client disconnects are **not** transmitted — a filter that quietly stopped matching would flood the monitor, and one that over-matched would hide real faults |
| **The browser reporter respects consent** | Verified in a browser: with `GLEX_CONSENT=all` the SDK loads and initialises with the expected DSN, `sendDefaultPii: false` and 6 ignore rules; with the cookie cleared it is never fetched at all. 6 unit tests on the gate itself, including that `NOT_GLEX_CONSENT=all` does not read as consent — `document.cookie` is writable by any script, so a substring match would be a consent bypass |
| **Health probes say only what a probe needs** | E2E + unit: liveness answers 200 (and HEAD) without touching the database; readiness answers 200 while it is up and **503 when it is not**, with the driver error logged server-side and kept out of the response — the probes are unauthenticated, so a host or connection string in a body would be public. A hung connection fails the probe at 5s instead of holding it open |
| **CI runs every check that has caught a real defect here** | `.github/workflows/ci.yml`: types, lint, unit, locale parity, encoding scan, production build and dependency audit on every push and PR; the E2E suite against a dev server on PRs and **against a production build** on main |
| **The whole suite passes against a production build** | 353 tests against `npm run build && npm start` with `NODE_ENV=production`, not just `next dev`. Sign-in works, so the reported Auth.js/Turbopack issue ([nextauthjs/next-auth#13353](https://github.com/nextauthjs/next-auth/issues/13353)) does not reproduce here. Runs in 2.7 min against 7.3 in dev |
| **Housekeeping runs without a cron** | Unit-tested (7 tests): the sweep fires on the first request rather than an hour after boot, skips the next request, resumes after the interval, claims its slot before awaiting so concurrent requests sweep once, and swallows a failure instead of breaking the response it runs after. Confirmed in production — see bug 20 |
| **A supplier edits only their own catalogue** | E2E: a supplier is refused another supplier's product, and their own edit succeeds. Scoped in SQL by `productWriteScope()`, not in the UI — see bug 18 |
| **Editorial flags stay with staff** | Unit-tested: a supplier cannot set `isFeatured` on their own product, so the homepage cannot be self-promoted into |
| **Only your own uploads can be attached to an RFQ** | Unit-tested against a mocked database, the one place the "someone else's file id" case can be produced without forging a Server Action request. Foreign ids are dropped, guests attach nothing, and the server applies its own cap of 5 rather than trusting the schema |
| **Product management** | E2E: create → PostgreSQL row (derived slug, brand, MOQ, category), appears in the public catalogue with no price, edit → row updated + `AuditLog`, delete → soft delete that keeps the row but removes the public page |
| **Category management** | E2E: create → row with derived slug; deleting a category that still has products is refused in the UI **and** by the server, so no catalogue entry is ever orphaned |
| **Content authorization** | E2E: client and supplier accounts are refused the product and category editors; every action re-checks its own permission because Server Actions POST to the page's own URL |
| **List pagination** | E2E: pages advance without repeating or skipping a row, a record pushed onto page two is still reachable, and an out-of-range page renders an empty list rather than an error. Admin RFQs/suppliers/shipments/inquiries/audit and client RFQs/shipments all paginate at 25 rows |
| **GLEX Assistant (chatbot)** | E2E: FAQ fallback answers, cites the matched entry, refuses to invent a price, resets, closes on Escape with focus restored, fully translated in Arabic |
| **Assistant runs without an API key** | With `ANTHROPIC_API_KEY` unset it degrades to verbatim FAQ/knowledge search and says so — the live path in the whole test suite |
| **Assistant conversation isolation** | Verified by request: a guessed conversation id cannot be rated, escalated, or appended to; every mismatch returns 404, never another visitor's transcript |
| **Assistant handoff is honest** | A signed-in person gets a real `GLEX-TKT-…` ticket; an anonymous visitor is sent to the contact form rather than promised a reply that cannot be delivered |
| Error handling | localized 404, root 404, `error.tsx`, `global-error.tsx`, `loading.tsx` |
| SEO | sitemap.xml with hreflang for all 5 locales, robots.txt, JSON-LD |
| Security headers | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |

### Foundation modules complete

`env.ts` (Zod startup validation) · `db.ts` (Prisma 7 + adapter singleton) ·
`auth.ts` (Auth.js v5, lockout, verification gate) · `rbac.ts` (13 roles,
38 permissions) · `auth-guards.ts` (SQL-level org isolation) · `password.ts` ·
`references.ts` · `rate-limit.ts` (durable, fail-open) · `company.ts` ·
`proxy.ts` · `i18n/*` · UI kit · layout · SVG world map · tracking provider
architecture (`types` / `internal` / `mock` / `registry`, HMAC webhook verification)

---

## Not yet implemented

Seven parallel build agents were dispatched for these and **all seven terminated
immediately on an API session limit without writing any files**. The areas below
were then completed by hand; what remains is listed honestly. Only two rows are
still short of done — malware scanning and the chatbot's live-key path — and
both are limits of this environment rather than unwritten code.

| Area | Spec § | State |
| --- | --- | --- |
| AI chatbot | 19 | **Done.** Widget, `POST /api/chat`, feedback, human handoff, guardrails, authorized tools and the no-key FAQ fallback all built and E2E-tested. Not yet exercised against a live Anthropic key — no key is configured here, so the AI branch of `askAssistant()` is unverified in practice |
| Chatbot admin surface | 19 | **Done.** Read-only transcripts at `/admin/chats` with an escalated-only filter |
| Admin portal extras | 16 | **Done.** Every surface built, including per-entity translation editing. UI-string translation editing is deliberately excluded — see the note below |
| Supplier portal lists | 15 | **Done.** Opportunities and the supplier's own catalogue are both paginated, with a unique tie-break key in the `orderBy` (see bug 13) |
| Malware scanning | 26 | Integration point exists and records its verdict; **deliberately returns `not_scanned`** rather than falsely reporting files clean |
| RFQ messaging / clarifications / quotations | 10 | **Done.** Client replies, staff replies with explicit visibility, quotation issue and client accept/decline — all E2E-tested |
| RFQ attachments (drawings, BOQs) | 10 | **Done.** Signed-in clients attach up to 5 files on the RFQ builder; every submitted id is re-read against `uploadedById` before it is stored. Guests are told to sign in rather than shown a control that cannot work — `/api/uploads` requires a session, and opening it to anonymous callers would make it a free file host |
| Supplier catalogue self-service | 15 | **Done.** Suppliers create and edit their own products, scoped by `productWriteScope()`; editorial flags stay staff-only (see bug 18) |
| Client dashboard extras | 14 | **Done.** Documents, team members and organization profile (read-only) plus support tickets with a two-way thread |
| News categories | 20 | **Done.** `/admin/news/categories`, with a guard against deleting a category that still holds articles |

| Webhook ingestion endpoint | 17 | **Done.** `POST /api/webhooks/tracking`, HMAC-verified, idempotent, out-of-order safe — 15 unit tests |
| Freight / document / container tools | 18 | Incoterms + container guide + checklist and the **freight quote form** all done |

### Remaining broken links

**None.** Every route linked from the header and footer now resolves.

Role-based redirects are now fully correct: `/dashboard` sends staff to `/admin`
and suppliers to `/supplier` via `homeRouteFor(user.role)`, and each portal
bounces the other roles to where they belong. All three directions are
E2E-tested.

Resolving today (each × 5 locales): `/`, `/about`, `/services`, `/network`,
`/resources`, `/faq`, `/tracking`, `/contact`, `/marketplace`,
`/marketplace/[category]`, `/products/[slug]`, `/rfq`, `/rfq/[reference]`,
`/privacy`, `/terms`, `/cookies`, `/accessibility`, `/login`, `/register`,
`/register/client`, `/forgot-password`, `/reset-password`, `/verify-email`,
`/dashboard` (+ `/rfqs`, `/rfqs/[reference]`, `/shipments`, `/saved`,
`/notifications`, `/security`), plus `/sitemap.xml`, `/robots.txt` and
`/api/auth/*`.

---

## Acceptance criteria (spec § 37)

| Criterion | Status |
| --- | --- |
| Application starts successfully | ✅ |
| Production build completes | ✅ |
| Logo correctly displayed | ✅ |
| GLEX colours consistently applied | ✅ |
| All five languages work | ✅ |
| Arabic fully RTL | ✅ |
| **Navigation works on desktop/tablet/mobile** | ✅ every linked route resolves |
| Type checking passes | ✅ |
| Linting passes | ✅ |
| Tests pass | ✅ 170 unit + 365 E2E (green against a production build as well as `next dev`) |
| Contact inquiries stored | ✅ verified in PostgreSQL |
| Shipments created and tracked | ✅ seeded shipment tracks with full timeline |
| Shipment events appear on a timeline | ✅ |
| Tracking adapters documented | ✅ README + provider interface |
| README complete | ✅ |
| Users can register as clients | ✅ E2E: register → verify → sign in |
| Emails use provider abstractions | ✅ console / SMTP / Resend, branded templates |
| **Products can be browsed and searched** | ✅ E2E: search, filter, sort, paginate, empty state |
| **Clients can add products to an RFQ** | ✅ E2E: cart persists in an httpOnly cookie |
| **No fake prices displayed** | ✅ E2E asserts no currency amount anywhere |
| **Clients can submit RFQs** | ✅ guest and signed-in, with email verification for guests |
| **RFQs saved to the database** | ✅ E2E asserts the row, items, quantities and activity record |
| **Server-side role permissions work** | ✅ E2E: route protection + organization isolation both exercised |
| **Clients can monitor RFQ status** | ✅ dashboard list + detail with activity history |
| **Admins can manage RFQs** | ✅ status changes, assignment, internal notes — all audited |
| **Admins can approve suppliers** | ✅ approve / conditionally approve / clarify / reject / suspend, with email + audit |
| **Suppliers see only their assigned opportunities** | ✅ enforced in SQL, E2E-verified against a second supplier |
| **Uploads are validated** | ✅ magic-number sniffing, size cap, filename sanitisation, unguessable keys, authorized download |
| No major accessibility errors | ⚠️ True for what exists; not independently audited |
| **Users can register as suppliers** | ✅ 6-step form → database, E2E-verified |
| **Products created and managed (admin)** | ✅ create/edit/publish/soft-delete with audit, E2E-verified against PostgreSQL. Suppliers now manage their own catalogue, scoped in SQL |
| **News managed / published; homepage slider** | ✅ authoring, scheduling, publishing and soft delete from the admin portal, all E2E-verified |
| **Chatbot with API key / FAQ fallback** | ⚠️ FAQ fallback built and E2E-verified; the API-key path is implemented but untested against a live key |

**31 of the 33 acceptance criteria are met outright; the other two are met in
substance with an honest caveat about verification, not about the feature.**

Counting whole specification sections rather than criteria, the build sits at
roughly **99%**. The three items last listed as missing — RFQ attachments,
supplier self-service catalogue editing, and pagination on the supplier lists —
are now built and tested. What remains is not unwritten code: malware scanning
needs a scanning service to call, and the chatbot's AI branch needs a live
Anthropic key. Both are wired and waiting on credentials.

The architectural foundation plus these verified end-to-end business flows:

1. public site → contact form → database (`GLEX-INQ-…`)
2. reference → tracking → milestone timeline
3. registration → email verification → authenticated session
4. catalogue → RFQ cart → submission → database (`GLEX-RFQ-…`)
5. sign-in → client dashboard → own RFQs and shipments, isolated in SQL
6. **staff → admin portal → audited RFQ and supplier decisions; suppliers →
   only their own assigned opportunities**
7. **visitor → GLEX Assistant → FAQ answer → feedback → human handoff**, with the
   transcript, rating and escalation all persisted and scoped to their owner

The admin portal is feature-complete apart from **UI-string translation
editing**, which is excluded on purpose for the reasons given below.

### Translation editing — deliberately not built

The `translation:write` permission and a `nav.translations` label both exist, so
this looks like a missing page. It is not an oversight.

There is **no general translation table**. The five locale files under
`messages/` are the source of truth for every UI string, and they are read from
disk at build time. An admin form editing them would have to write to the
repository at runtime, which fails on any read-only or replicated deployment,
bypasses review of customer-facing copy, and defeats `scripts/verify-locales.mjs`
— the check that keeps all five locales at identical key and placeholder sets.

What *is* editable per-locale, and already has admin surfaces, is the content
that lives in the database: email templates (`/admin/emails`), FAQ entries,
announcements, and the per-entity translation tables (`CategoryTranslation`,
`ProductTranslation`, `NewsTranslation`, `OfficeTranslation`,
`NewsCategoryTranslation`, `AnnouncementTranslation`).

Per-entity translation editing **is now built** — see `TranslationEditor`, mounted
on the product and article edit pages. It covers all four kinds; categories and
news categories simply are not mounted yet.

---

## Notable bugs found and fixed during verification

1. **Breadcrumbs produced `/en/en`.** `PageHero` was passed locale-prefixed
   hrefs, but the next-intl `Link` prepends the locale itself. Fixed to take
   locale-less hrefs; guarded by an E2E regression test.
2. **`upgrade-insecure-requests` in development.** The CSP rewrote
   `http://localhost` fetches to `https://`, where nothing listens. Now emitted
   in production only.
3. **Auth.js JWT augmentation targeted the wrong module.** `next-auth/jwt` is a
   bare re-export; augmenting it compiles but silently degrades every custom
   claim to `unknown`. Corrected to `@auth/core/jwt`.
4. **Encoding damage from a bulk edit.** A PowerShell rewrite introduced BOMs
   and mojibake into 7 files; detected with a scanner and repaired.
5. **`setState` inside an effect** in the mobile nav caused cascading renders;
   replaced with the adjust-state-during-render pattern.
6. **`revalidatePath('/[locale]/rfq')` on a route that did not exist yet**
   raised a server error on every cart mutation. Removed — the RFQ page is
   dynamic and re-reads the cookie per request, so no revalidation is needed.
7. **Empty `<select>` and hidden inputs submit `""`, silently failing Zod.**
   `z.nativeEnum(Incoterm).optional()` and `z.string().uuid().optional()` both
   reject `""`, so every RFQ submission failed validation and nothing reached
   the database. Fixed by accepting `""` as a valid value and normalising it
   server-side. **Do not reach for `z.preprocess` or `z.coerce` here** — both
   make the schema's *input* type `unknown`, which breaks React Hook Form's
   resolver typing.
8. **A server-side validation failure rendered nothing**, so the submit button
   looked dead. Every failure branch now surfaces a message.
9. **A form field was labelled "Search"** because a `common` key was reused
   lazily. Added a proper `rfq.itemName` key to all five catalogues, keeping
   key order identical.
10. **Lucide icon components were passed from a Server Component to a Client
    Component**, which crashed every dashboard page with *"Functions cannot be
    passed directly to Client Components"*. Props crossing that boundary must
    be serializable, and a React component is a function. Fixed by passing an
    icon **name** and holding the name→component map inside the client
    component. Watch for this in the admin portal, which has the same shape.
11. **A `<form action="/api/auth/signout">` would have silently failed** —
    Auth.js requires a CSRF token on that endpoint. Replaced with a client
    component using `signOut()`.
12. **The chatbot's fallback answered without saying which question it matched.**
    Deterministic keyword search legitimately returns a near neighbour — asked
    "How do I submit an RFQ?" it returned the answer to "Do I need an account to
    submit an RFQ?", which reads as a wrong answer rather than a near miss. The
    matched entry's title is now shown above the answer.
13. **Paginated queries could show a row twice — or never.** Every list ordered
    by `createdAt` alone, which is not unique. `LIMIT/OFFSET` needs a *total*
    order: PostgreSQL is free to break a tie differently on each query, so rows
    sharing a timestamp (a bulk import, two same-second submissions) could
    appear on both page 1 and page 2 while others vanished entirely. Found by an
    E2E test that created 26 RFQs in one `createMany` — 22 of 25 rows were
    duplicated across the two pages. Fixed by appending a unique `id` key to
    every paginated `orderBy` in `admin.ts`, `dashboard.ts`, `audit.ts`,
    `news.ts` and `catalogue.ts`.
14. **`extractToolNames()` typed its parameter structurally** as
    `{ toolCalls?: { toolName: string }[] }[]`. The AI SDK types a step's
    `toolCalls` as a union generic over the tool map, which does not match that
    shape, so `npx tsc` failed. Narrowed at runtime from `readonly unknown[]`
    instead — only the names are needed, and `any` was not required.
15. **The homepage news slider crashed when only one article was published.**
    `embla-carousel-autoplay` returns early from its own `init` when the
    carousel has one scroll snap or fewer — there is nothing to rotate — and
    that return happens *before* it builds its internal delay table. `play()`
    stays callable, reaches `setTimer`, and indexes the undefined table:
    *Cannot read properties of undefined (reading '0')*. Fixed by checking
    `scrollSnapList().length > 1` before calling `play()`, re-evaluated on
    Embla's `reInit` because the snap count changes with the viewport.

    Two things are worth remembering. First, this is a **different cause with
    the same error message** as item 6, which is why that regression guard did
    not catch it. Second, React Strict Mode masks it: the double mount leaves
    the plugin's `destroyed` flag `true`, so `startAutoplay()` returns before
    reaching the crash. It therefore reproduces on first mount only and cannot
    be reliably caught in a browser test — the guard is pinned by a unit test
    (`src/components/news/__tests__/autoplay-guard.test.ts`) that drives the
    real plugin and asserts `play()` throws at one snap.

16. **Every export of a `'use client'` module is a client reference.** A date
    helper defined next to the article form and imported by the Server
    Component page threw *"Attempted to call toDateTimeLocal() from the server
    but toDateTimeLocal is on the client"*, and the page rendered nothing —
    HTTP 200 with no `<form>` in the body. Pure helpers shared across the
    boundary belong in a module without the directive (`src/lib/utils.ts`).
17. **A publication time entered as "09:00" must mean 09:00 in Jeddah.**
    Converting with `Date#getTimezoneOffset` uses the *host's* zone, so a server
    in UTC would shift every scheduled article by three hours, and a server
    render would disagree with the browser on hydration. Both directions now go
    through `toDateTimeLocalInput` / `fromDateTimeLocalInput`, which are pinned
    to `COMPANY_TIME_ZONE` and unit-tested as a round trip.

18. **Opening the catalogue to suppliers opened it to *every* supplier.**
    `saveProduct` and `deleteProduct` looked up a product by id alone. Adding
    the supplier portal to that action meant any approved supplier could edit
    or soft-delete any product in the system — including a competitor's — by
    changing the id in the form. A permission check is not an ownership check:
    `product:write` says *may edit products*, never *may edit this one*. Fixed
    with `productWriteScope()`, which returns a `WhereInput` narrowing the
    query itself, so the row is never found rather than found and then
    rejected. Two details matter. A supplier with no profile must not match
    `supplierId: null`, which is every unattributed product — an id that cannot
    exist is used instead. And `isFeatured` is forced false for non-staff, or a
    supplier could put themselves on the homepage.
19. **A layout is not a security boundary.** `/admin/products` guarded
    `product:read` in its layout, but Next renders the layout and the page
    **concurrently** — the page's query had already run and its product names
    were already in the RSC payload by the time the layout's `forbidden()`
    resolved. The rendered HTML was correct, so nothing looked wrong; the leak
    was visible only in the streamed payload. Every guard now runs in the page
    itself via `requireStaffPermission()`.

20. **Two prune functions nothing called.** `pruneRateLimits()` and
    `pruneTokens()` were both written and both documented "safe to call from a
    scheduled job" — and no scheduled job was ever built. `RateLimit` grew a row
    per unique IP per action forever, and consumed password-reset tokens were
    never deleted. Neither is an authorization hole (an expired bucket resets on
    next use; a used token is refused on its `usedAt`), but an unbounded table of
    stale security material is not something to keep. **The first request to the
    production server pruned 1,143 tokens**, which is how long they had been
    accumulating. Fixed in `src/lib/maintenance.ts`, driven by ordinary traffic
    through `after()` rather than by an operator remembering to configure cron —
    depending on that configuration is how this ended up wired to nothing in the
    first place.

21. **`output: 'standalone'` shipped the secrets and the customer files.** The
    first standalone build copied a byte-identical `.env` — `AUTH_SECRET`, the
    database password, the SMTP password — and all 15 uploaded documents from
    `storage/` into `.next/standalone`. Anyone holding the resulting image or
    tarball would hold all of it. File tracing follows `fs` usage as well as
    imports and is greedy, so `storage/`, `e2e/` and the test-output directories
    are now in `outputFileTracingExcludes`.

    `.env` could not be fixed that way. Next copies `.env` and `.env.production`
    into the standalone output **unconditionally**, outside the tracing system
    — see `writeStandaloneDirectory` in `next/dist/build/index.js`, which is
    worth reading before assuming any exclude option covers it. That one is
    handled in `scripts/package-standalone.mjs` instead, which also copies the
    `public/` and `.next/static` directories that `server.js` will not serve
    without. A CI build has no `.env` on disk and is unaffected; the script is
    the safety net for builds on a developer machine.

22. **The documented way to remove demo data did not exist.** README and this
    file both stated that "every record is flagged `isDemo` / `isSample` so it
    can be filtered or deleted from the admin portal". `isDemo` is on `Shipment`
    and `isSample` on `NewsArticle` — and nowhere else. Demo **users**,
    organizations, products and RFQs carry no flag at all, so the one documented
    procedure for the go-live cleanup did not work for the records that matter
    most. Found by reading the schema before writing the purge script rather
    than trusting the prose. The only handle on the accounts is the
    `@glex.demo` suffix, which is what `scripts/purge-demo-data.mts` uses; it
    refuses to guess at the unflagged records and says so instead.

### Test-infrastructure issues worth knowing

These cost real debugging time and will recur if the causes are forgotten.

- **`next dev` compiles routes on first request.** Saturating it with one worker
  per CPU makes Turbopack serve incomplete RSC payloads: the browser reports
  `SyntaxError: Unexpected end of JSON input` and the page stays on its
  `loading.tsx` fallback. Fixed by capping workers at 4 and warming every route
  serially in `e2e/global-setup.ts`.
- **Running E2E against `next start` needs its own environment** — `src/lib/env.ts`
  deliberately refuses `EMAIL_PROVIDER=console` and `SEED_DEMO_DATA=true` under
  `NODE_ENV=production`. This was previously written up as "not a workaround",
  which was wrong and left the production path untested: point `EMAIL_PROVIDER`
  at a local SMTP sink and rely on the database already being seeded, and the
  whole suite runs. **Do this before a release** — everything else in this
  section is dev-server behaviour, and the production server exhibits none of it.
- **Next injects `#__next-route-announcer__` with `role="alert"`.** Scope
  page-level role locators to `#main-content` (see `e2e/helpers.ts`).
- **Required fields render a visual `*` inside the `<label>`,** so the accessible
  name is `Email*`. Never use `{ exact: true }` with `getByLabel` here.
- **Responsive tables render twice** — a desktop `<table>` and a mobile card
  list, with CSS hiding one. Both are in the DOM, so text locators match twice.
  Use `.filter({ visible: true })`, **not** `locator('table')`: scoping to the
  table passes on desktop and can never pass in the `mobile-chrome` project,
  where the table is present but hidden. Two specs were wrong this way.
- **Per-IP rate limits are shared by the whole suite.** Every request arrives
  from loopback, so both projects and consecutive local runs draw on the same
  budget — 5 contact messages an hour was exhausted after three runs, and the
  failure looked exactly like a broken form. `e2e/global-setup.ts` now clears
  loopback buckets before warming routes. The limits themselves stay
  production-strength and are unit-tested.
- **The `next dev` overlay occupies the bottom-left corner** and swallows
  synthetic clicks that land there. In an RTL locale that is where an
  inline-end-anchored control sits, so the chat launcher is unclickable in
  `/ar` under `next dev` only. Activate it from the keyboard in tests;
  `devIndicators: false` does **not** remove the hit area.
- **Retrying a `fill()` with the same value does nothing.** `fill()` updates
  React's internal value tracker, and React suppresses the change event when the
  value it is handed already matches the tracker — so a retry loop that writes
  an identical string can never recover from a fill that landed before
  hydration. The scheduled-publishing test wrote
  `toDateTimeLocal(Date.now() - 60_000)` on every attempt; a `datetime-local`
  has minute precision, so that string is constant for a minute while the loop
  gave up after 40 seconds. It failed roughly one run in three and looked like
  load flakiness. Each attempt now steps back one further minute, which is the
  smallest change that reliably fires the event.
- **`getByLabel` matches label TEXT; `getByRole(…, { name })` matches the
  ACCESSIBLE NAME.** A required field renders a visual `*` inside its `<label>`,
  so `getByLabel('Category', { exact: true })` finds nothing while
  `getByRole('textbox', { name: 'Category', exact: true })` works — the marker
  is `aria-hidden`. Use the role locator to disambiguate "Title" from
  "SEO title" or "Category" from "Parent category".
- **`next dev` intermittently 500s under full-suite parallel load** with
  *"No intl context found"*, which then cascades into `useTranslations` errors
  from client components. It is not route-specific — the client dashboard shows
  it too — and it clears after `Remove-Item .next -Recurse -Force` plus a
  restart. Do not assert a bare `response.status()` on a page navigation; wrap
  it in `expect(...).toPass()` so a persistent failure still fails but a single
  transient one does not.
- **A streamed `notFound()` is served with HTTP 200.** Once the response has
  started, Next cannot change the status, so `expect(response.status()).toBe(404)`
  fails on every page-level 404 in the app. Assert the rendered "Page not found"
  copy instead. Next injects `<meta name="robots" content="noindex">` on the
  not-found boundary, which is what actually keeps a soft 404 unindexed — do not
  hand-write another one, the page ends up with several.
- **`innerText()` is a one-shot read with no auto-wait,** so it happily captures
  a Suspense fallback. Assert something from the loaded view first.
- **A control backed by an async-initialising library can drop a click.** Embla's
  `scrollNext()` is inert until it has measured the track, so a single click plus
  a wait can never converge. Wrap click-and-assert in `expect(...).toPass()`.
- **Playwright's `error-context.md` names the real cause.** Twice, a truncated
  console log made a *strict mode violation* look like a missing element. Read
  that file before theorising.
- **A corrupted Turbopack dev cache produces the same JSON error.** If you see
  `Failed to generate static paths` or `Unexpected non-whitespace character
  after JSON at position N` repeating at a fixed offset, it is `.next/dev`, not
  your code. `Remove-Item .next -Recurse -Force` and re-run.
- **Tests that share mutable state must run serially.** Two blocks are
  `test.describe.serial`: RFQ submission (parallel workers race over the same
  per-IP rate-limit budget) and sourcing opportunities (one test asserts an
  empty list while another creates a row for the same supplier).
- **Do not pin a seeded reference in a list assertion.** Admin lists are capped
  and ordered newest-first, so `GLEX-RFQ-2026-000001` silently fell off page one
  once the suite had generated enough data. Create a record in the test instead.
- **Never run the E2E suite alongside typecheck/lint/build.** They contend for
  CPU and the dev server, producing failures that look like regressions.
- **`locator.count()` does NOT auto-wait.** It queries immediately and returns 0
  before the page renders. Always assert through `expect()`, which retries.
- **Add every new route to `e2e/global-setup.ts`.** An unwarmed route compiles
  on first request and can serve an incomplete RSC payload under parallel load.
- **Headless Chromium reports `prefers-reduced-motion: reduce` by default,** so
  anything gated on motion behaves differently in tests than in a real browser.
  Set `reducedMotion` explicitly on the context when it matters.
- **Autoplay makes elements permanently "unstable"** for Playwright's
  actionability check, because the transition keeps shifting layout. Test
  carousel navigation with `reducedMotion: 'reduce'`.
- **The embedded preview browser is not a reliable oracle.** It showed every page
  stuck on "Loading" with unhydrated forms; real Chromium showed the app was
  fine. Verify with Playwright, not the preview pane.
- **Do not bulk-edit source with PowerShell `Set-Content`** — it double-encodes
  UTF-8. `scripts/check-encoding.mjs` detects it; `scripts/fix-mojibake.mjs`
  repairs it.

---

## Recommended order to continue

Every surface in the specification is now built. What remains is optional
extension rather than a gap:

1. **Translations for categories and news categories.** The editor
   (`TranslationEditor`) and its action already handle all four kinds — only
   `product` and `article` are mounted so far. Mounting the other two is a
   props change on the relevant admin pages, not new machinery.
2. **UI-string translation editing** is deliberately *not* on this list. Read
   *Translation editing* below before anyone proposes it again.

### Two things that cost time in this codebase

**Check whether anything reads the table before building the write.** Three
surfaces in a row — user deactivation, `Organization.isActive` and the whole
`Office` table — turned out to be wired to nothing, so the obvious form would
have edited rows no code consulted. Grep for a read first.

**Name what a button saves.** Adding a plain "Save" to a page that already has
one broke a pre-existing test twice — once for the staff RFQ reply, once for the
translation editor. Both were genuine UI faults, not test faults: two buttons
reading the same word tell the user nothing either.

### Contracts any continuation must honour

- Import `Link` / `useRouter` / `redirect` from `src/i18n/navigation`, never from
  `next/*`, or the locale is dropped. Breadcrumb/`PageHero` hrefs are locale-less.
- Every privileged page, server action and route handler calls a guard from
  `src/lib/auth-guards.ts`. `src/proxy.ts` is **not** a security boundary.
- New `t()` keys must be added to all five `messages/*.json` — the build fails
  otherwise, by design, and `messages.test.ts` enforces parity.
- Use logical Tailwind utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`)
  so Arabic mirrors correctly. Never `ml-`, `pl-`, `left-`.
- Never display a price. The catalogue is RFQ-based: "Price on request". An E2E
  test asserts no currency amount appears anywhere in the catalogue.
- **A dynamic route is revalidated by its ROUTE PATTERN, not an interpolated
  URL.** `revalidatePath('/[locale]/products/cement', 'page')` matches nothing
  and fails silently; use `'/[locale]/products/[slug]'`.
- **Every paginated `orderBy` must end with a unique key** (`{ id: 'desc' }`).
  Without it, `LIMIT/OFFSET` over a non-unique sort column can return the same
  row on two pages and skip others. Use the helpers in `src/lib/pagination.ts`
  rather than parsing `?page=` by hand.
- The RFQ cart cookie stores only ids, quantities and units. Product details are
  always re-read from the database, so a tampered cookie cannot inject content.
- Uploads: never trust the client's MIME type or filename. `sniffType()`
  determines the format from magic numbers, the key is generated server-side,
  and `/api/files/[id]` re-authorizes on every request.
- A supplier must never learn which client an opportunity came from. Select only
  the commercial fields of the RFQ, as `listMyOpportunities()` does.
- **Banking details are never requested during public registration** (spec §11).
  Do not add IBAN/SWIFT/account fields to `supplier-registration.ts`; an E2E
  test walks all six steps and fails if any appear.
- In a multi-step form, guard the submit handler on the current step. "Next" and
  "Submit" share a position, and React reuses that DOM node — without the guard
  a click on "Next" can post the form a step early (this actually happened).
- **No optional script may be sent to the browser before consent.** Read the
  choice server-side with `isAnalyticsAllowed()` and omit the tag entirely —
  never send it and suppress it client-side. Refusals are recorded too.
- Never present seeded or mock data as live carrier data.
- No fabricated statistics, clients, testimonials, certifications, partnerships
  or awards. Demonstration content must be labelled and deletable.
- **Do not bulk-edit source files with PowerShell `Set-Content`** — it corrupts
  UTF-8. Use the editor tools, or `scripts/fix-mojibake.mjs` to repair.

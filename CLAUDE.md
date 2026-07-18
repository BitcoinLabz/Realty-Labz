# Realty Labs — Project Guide for Claude Code

## Overview
Realty Labs is a web application built for real estate agents (starting with Michigan) to manage their business finances, mileage/tax deductions, and client documents in one place. It launched as an individual-agent tool and is now formally expanding into a multi-tenant SaaS platform — individual agents, teams, and brokerages/offices as first-class account types, with role-based permissions (Broker, Admin, Team Lead, Agent) and complete data separation between organizations. See "Platform Expansion Roadmap" below for the phased plan.

**Founder context:** Built by a working Michigan realtor who wants a lean, low-cost MVP first, with an eye toward pitching this to their brokerage for team-wide use later — the Platform Expansion Roadmap below is that pitch made concrete.

**Long-term direction:** the goal is for Realty Labs to grow into a one-stop shop for an agent's entire business and financial life — personal finances, investments and other assets, clients, listings, and contracts, not just business income/expense bookkeeping. See "Long-Term Vision" below. V1 stays scoped to the business-finance core defined in the roadmap; this broader direction should inform architecture decisions (e.g., keep data models extensible rather than assuming "only business transactions" will ever exist) without pulling future scope forward into the current build.

## Design & Quality Bar (read this before building anything)
This is the top priority of the project, alongside cost-consciousness — **the app should feel like it was designed by Apple.** That means:
- Clean, minimal, uncluttered UI. Generous whitespace. Restrained color palette. No visual noise.
- Careful typography, spacing, and alignment — details are not "polish for later," they're the product.
- Every interaction should feel obvious and frictionless — no confusing flows, no dead ends, no unnecessary steps or fields.
- Smooth, subtle motion/transitions (state changes, loading states, page transitions) — never jarring, never gratuitous.
- Consistency: the same component, spacing scale, and interaction pattern used everywhere it applies. No one-off styling.
- Prefer removing a feature/field/step over shipping it half-considered. Simplicity and clarity beat feature count.
- When a UI decision is ambiguous, default to the simpler, calmer option.
- This bar applies from the first screen built (auth/onboarding) — do not plan to "add polish later."

## Tech Stack
- **Frontend + Backend:** Next.js (App Router) — this **is** React; there's no separate frontend framework decision to make.
- **Database:** PostgreSQL, hosted on Supabase. Prisma is still the ORM/query layer (via `@prisma/adapter-pg`, see `src/lib/db.ts`) — Supabase here means "hosted Postgres + storage," not the Supabase client/SDK for data access.
- **File storage:** Supabase Storage (private `documents` bucket) — see `src/lib/document-storage.ts` and `src/lib/supabase.ts`. Replaced local disk storage; see "Current Status" for the migration note.
- **Hosting:** Vercel
- **Version Control:** GitHub
- **Auth:** NextAuth.js (Auth.js v5) with the Credentials provider — email + password only for v1, JWT session strategy (no adapter/DB sessions needed). Deliberately **not** Supabase Auth — decided 2026-07-16 to keep the already-working NextAuth flow rather than rewrite it; Supabase is DB + storage only here. Google/social login is a possible later addition, not v1.
- **UI:** Tailwind CSS + a small set of consistent, accessible primitives (e.g. shadcn/ui as a base) — favor a restrained design system over ad-hoc styling, in service of the Apple-like quality bar above.

## Architecture Principles
- Keep infrastructure costs near zero until the app has proven traction.
- Build with a `users` → `teams` relationship from day one (roles: `agent`, `team_lead`, `admin`), even though v1 only needs individual-agent functionality. Do not hardcode single-user assumptions.
- Web-first, fully responsive — no native mobile or desktop app for v1. Mobile wrapping (React Native/Expo) is a possible future phase, not now.
- Michigan-only tax/mileage rules for v1. Store state-specific rates/rules (e.g., mileage deduction rate) in a config/table that's easy to update annually and easy to extend to other states later — not hardcoded in logic.
- **Multi-tenant data isolation is enforced in application code, not database RLS.** Because auth stays on NextAuth (not Supabase Auth — see Tech Stack), Postgres Row-Level Security keyed to `auth.uid()` isn't available to us. Every query touching tenant-scoped data (transactions, deals, documents, clients, templates, etc.) **must** filter by the owning `userId` and/or `teamId` explicitly in the Prisma call — the same pattern already used in every `src/app/actions/*.ts` file (e.g. `deleteMany({ where: { id, userId } })`). This is the load-bearing security boundary for the whole multi-tenant platform; treat any query missing that scoping as a bug, not a style nit.
- **Team = tenant/organization**, regardless of size. A `Team` row represents anything from a 2-agent team to a full brokerage — there is deliberately no separate "Brokerage/Office" model layered above `Team`. Simpler data model, avoids premature nesting; revisit only if a real customer needs teams-within-a-brokerage.

## Core Data Model (initial draft)
- **users** — agent accounts, auth info, role, team_id (nullable for solo agents)
- **teams** — optional grouping for brokerages/team features (v2 activation); also the multi-tenant unit — see Architecture Principles ("Team = tenant/organization")
- **clients** — belongs to a user; contact info, notes
- **properties/listings** — optional, tied to clients
- **transactions** — income/expenses; category field (mileage, home office, phone, other); tied to user
- **mileage_logs** — trip records: date, distance (miles, manually entered), business/personal flag, note (e.g. client name/purpose), calculated deduction amount (rate × miles at time of trip)
- **documents** — contracts/PDFs; tied to client and/or user; supports e-mail-a-link-to-client flow for client-filled info (v2)

**⚠️ Naming collision to plan around:** the existing `Transaction` model means an *income/expense ledger entry*. The Platform Expansion Roadmap's "Transaction Management" (Phase 2) means a *real estate deal* (buyer/seller side, timeline, deadlines, commission). These are different things that will both need to exist — when Phase 2 is built, the deal-tracking model needs its own name (e.g. `Deal` or `RealEstateTransaction`), not `Transaction`. Flagging now so it isn't a surprise later.

**Not yet in the schema, needed for Phase 2+ (see Platform Expansion Roadmap):**
- `Role` enum needs a `BROKER` value added (currently `AGENT` / `TEAM_LEAD` / `ADMIN`) to match the doc's Broker / Admin / Team Lead / Agent hierarchy.
- A deal-tracking model (see naming collision above): buyer/seller workflow state, timeline, deadlines, commission, shared team access.
- Reminder/notification records tied to deal deadlines (Phase 3).
- Document template model for brokerage-level shared templates with auto-filled office/agent info (Phase 2 Document Management).

## Feature Roadmap

### V1 (MVP — build in this order)
1. **Authentication** — agent signup/login
2. **Dashboard** — light/dark mode toggle; at-a-glance view of income, expenses, mileage savings
3. **Expense & income tracking** — categorized (home office %, phone, vehicle, other business expenses) for tax purposes
4. **Mileage tracker (manual entry)** — user manually logs each trip: date, miles, business/personal flag, and a note field (e.g. "Showing to Joe Smith"); calculates deduction using current MI state mileage rate and shows dollar amount saved per trip. Make manual entry itself fast and pleasant (minimal taps/fields, smart defaults) since it's the core interaction — see "Future" note below for why this isn't automated in v1.
5. **Client management** — basic client records (contact info)
6. **Document storage** — upload/store contracts and PDFs per client

**Key deliverable inside V1:** PDF export of financials for accountants — leads with net income/loss summary, then itemized breakdown by category showing how the numbers were calculated (mileage trips + rate, expense categories, etc.)

### Future — Native App Phase (not v1, not v2 — a distinct later phase)
- **Automatic, location-based mileage/trip detection** (background GPS logging, auto-classify business/personal) is explicitly deferred until the app is wrapped as a native app (React Native/Expo). Continuous background location tracking is not reliably achievable in a responsive web app (mobile browsers, especially iOS Safari, restrict background GPS access), so don't attempt to build this into the web app — manual entry is the correct v1 approach, not a stopgap to route around technically.

### V2 (Post-MVP)
- AI-powered image editor for listing photos — **superseded by Platform Expansion Phase 5 below**, which covers this plus broader marketing/AI tooling
- Expanded export options (Excel, CSV in addition to PDF)
- Email-a-link contract flow — client fills in their own info remotely (SkySlope-style, but aiming for fewer bugs, especially around signature fields)
- Team features activation (shared client/document access, team lead reporting dashboard) — **superseded by Platform Expansion Phase 2 below**, which expands this into full broker/office multi-tenancy
- CRM-style notes per client
- Leads tracker with follow-up reminders

## Platform Expansion Roadmap (Multi-Tenant SaaS)
Added 2026-07-17, from the founder's "Real Estate Agent SaaS Platform — Project Vision & Roadmap" doc. This **builds on top of** V1/V2 above, not a replacement — V1 is functionally complete (including the PDF export) and already covers more than this doc's own Phase 1 (it also includes mileage tracking and client management, which this doc places under Phase 4 and doesn't explicitly mention, respectively).

**Stack notes specific to this expansion** (see Tech Stack above for the full picture): auth stays NextAuth, not Supabase Auth — decided 2026-07-16, holds for this expansion too. That means multi-tenant data separation is an application-layer responsibility (see Architecture Principles), not automatic via Postgres RLS. Keep that front-of-mind for every Phase 2+ feature below; a missed `teamId`/`userId` filter is a cross-tenant data leak, not a cosmetic bug.

#### Phase 2 — Transaction Management, Broker/Office Dashboard, Team Management
Planned 2026-07-17. Decisions locked in during planning:
- **Team invites are shareable links, not real emails** — no transactional email provider yet (keeps cost/setup at zero for now). A manager generates a link with an expiring token; they send it themselves via whatever channel. **Pre-launch TODO:** once Vercel + Supabase are live, revisit this — at minimum the invite link needs a real base URL instead of `localhost:3000`, and real email delivery (e.g. Resend) is worth adding at that point instead of staying manual-link-only forever.
- **Deal deadlines are a flexible task list**, not fixed fields (inspection/financing/closing hardcoded on the deal itself) — a generic `label` + `dueDate` + `completedAt` per deadline, added freely per deal. Chosen specifically because Phase 3's automatic deadline detection and reminders need to create arbitrary deadlines, not just fill in three predetermined slots.
- **Team Lead has team-wide visibility**, same as Admin and Broker — all three see every deal/agent on the team; only Agent is scoped to their own. Practically, `TEAM_LEAD` / `ADMIN` / `BROKER` are one "manager tier" for data-access purposes in Phase 2 (a shared `isManager(role)` check), even though they're separate enum values and may earn distinct capabilities later (e.g. billing, removing the team itself — not designed yet).

**New data models needed** (none of these exist yet):
- `Role` enum gains `BROKER` (currently `AGENT` / `TEAM_LEAD` / `ADMIN`).
- `Deal` — the buyer/seller transaction/workflow itself. Fields: `side` (BUYER/SELLER/DUAL), `status` (ACTIVE/UNDER_CONTRACT/PENDING/CLOSED/FELL_THROUGH), `propertyAddress`, `mlsNumber`, `listPrice`, `salePrice`, `commissionRate`, `commissionAmount`, `closingDate`, `notes`. Scoped by `userId` (the assigned agent) exactly like every other model — **not** a `teamId` field; team-wide visibility for managers is a query-time join through `user.teamId`, not stored redundantly on the deal. Optionally linked to an existing `Client`. This is the model that resolves the naming collision noted under Core Data Model — it is explicitly **not** named `Transaction`.
- `DealDeadline` — the flexible task list per the decision above: `label`, `dueDate`, `completedAt` (nullable — set when done), belongs to a `Deal`.
- `Document.dealId` (new nullable field, same pattern as the existing `Document.clientId`) — so contracts can be tied to a deal.
- `TeamInvite` — `token` (unique, expiring), `teamId`, `role` (what the invitee becomes), `expiresAt`, `usedAt` (nullable), `createdBy`.

**Build order:**
1. `Role` enum: add `BROKER` (small migration, no UI yet).
2. Team invites: `TeamInvite` model; an invite-generation UI for managers; a public `/join/[token]` page (no auth required to view) that behaves like signup but pre-fills the team/role from the token instead of asking solo-vs-team; mark the invite used on signup.
3. `isManager(role)` helper (`src/lib/authorization.ts` or similar) — the one place that defines "team-wide visibility" so every Phase 2+ query uses the same rule instead of each feature reinventing it.
4. `Deal` + `DealDeadline` models and migration.
5. Deals CRUD page(s): create/edit/delete a deal, manage its deadline list (add/complete/delete), optionally link a client — following the same add/edit/delete-with-inline-form pattern already used for transactions, mileage, and clients.
6. Contract documents tied to a deal: extend the existing `/documents` upload/reassign flow so a document can link to a `dealId` in addition to (or instead of) a `clientId`.
7. Broker/office dashboard (new page, e.g. `/team`): agent list with basic per-agent stats (active deals, closed deals, commission this period), upcoming/overdue deadline alerts across the team, missing-document alerts (a deal missing an expected document type — simple heuristic first pass), basic performance reporting. This is the piece that most depends on everything above already working.
8. Document Management System upgrades (library view, brokerage-level templates with auto-filled office/agent info, version control, search) — lower priority within Phase 2; can follow once 1–7 are solid rather than blocking them.

#### Phase 3 — AI Document Recognition, Deadline Automation, Notifications
- Document recognition: automatic classification of uploaded forms, data extraction from contracts
- Automatic deadline detection from contract data; missing-document identification
- AI-generated transaction (deal) summaries; natural-language search across deals
- Reminders: auto-generated from deal deadlines, with email + in-app notifications to agents and clients, task-completion tracking, and automatic reminder cancellation once the underlying task is done
- Financial tools upgrade: commission reporting, tax-prep reports, business-deduction tracking, year-end summaries — builds on the existing `/transactions` page and the V1 PDF export deliverable rather than replacing them

#### Phase 4 — Mobile App (iOS & Android)
- Automatic mileage/drive detection and business-vs-personal trip classification — **this is the same thing already described under "Future — Native App Phase" above**, just formalized here as part of the mobile app phase. The manual mileage tracker already built in V1 stays as the web-based entry method regardless; this phase is additive (automatic detection), not a replacement.
- Receipt scanning and expense capture
- Mobile push notifications

#### Phase 5 — Marketing Tools & Advanced AI
- Listing description generation, social media content generation
- Photo background removal, basic photo editing tools (supersedes V2's "AI-powered image editor" item above)
- Marketing automation

### Long-Term Vision (beyond V2 — directional, no committed timeline)
- **Data visualization**: charts/graphs for income & expenses over time (trends, category breakdowns), not just the current at-a-glance summary cards — applies to both existing business transactions and the investments/assets below once built.
- **Investments & other assets**: track personal investments and other assets, not just business income/expenses — broadens the app from a business-expense tracker into full personal finance management for the agent. Will need new data models (e.g. `investments`, `assets`); not designed yet.
- **Positioning**: the aim is a one-stop shop covering personal finances, clients, listings, and contracts — an agent's entire business and financial life in one app, beyond just tax-deduction bookkeeping.
- Directional only — don't pull these into V1/V2 scope. Use this section to inform architecture decisions (extensible data models, room for a "financial trends" view) rather than to schedule work.

## Current Status
Built so far: project scaffold, Prisma schema + migrations, the full auth/account-management workflow, expense & income tracking (V1 item 3), the mileage tracker (V1 item 4), client management (V1 item 5), document storage (V1 item 6), and the PDF export deliverable. **V1 is functionally complete.** Platform Expansion Phase 2 (multi-tenant broker/office features, deal tracking) is next.

- *Signup (solo or "start a team" choice, creates a `Team` + `TEAM_LEAD` user if team-mode), login, logout*
- *Protected `/dashboard`, `/account`, `/transactions`, `/clients`, and `/documents` routes (via `src/proxy.ts`)*
- *Account settings: edit display name, change password, view account type (solo vs. team + role)*
- *Finances at `/transactions` (V1 items 3 & 4, combined into one page): income/expense tracking (add/edit/delete, type toggle, category for expenses — home office, phone, other business expense) plus the mileage tracker (add/edit/delete trips, business/personal toggle, optional note) on the same page, sharing a single year filter. `MILEAGE` is reserved as a transaction category for future use but isn't manually selectable — mileage lives in its own section, not as a manual transaction. Deduction per trip is computed server-side (`miles × rate at time of trip`, via `src/lib/mileage-rate.ts`) and stored on the `mileage_logs` row — not recalculated on the fly — so historical trips keep the rate that applied when logged even after the seeded rate changes. Personal trips show "Not deductible" rather than `$0.00`. Summary cards: Income, Expenses, Mileage deduction, Net (= income − expenses − mileage deduction).*
- *Client management at `/clients` (V1 item 5): add/edit/delete client records (name, email, phone, notes).*
- *Document storage at `/documents` (V1 item 6): upload PDFs/Word docs/images (15MB cap), optionally link to a client (reassignable after upload), download, delete. Files live in a private Supabase Storage bucket named `documents` (`src/lib/document-storage.ts`), reachable only through the authenticated `GET /api/documents/[id]` route — the Supabase client uses the service-role key server-side and bypasses RLS, since ownership is already enforced against Postgres before any storage call. Originally built with local-disk storage (deliberately, to keep building without an external account); migrated to Supabase once the account existed. **Not yet live** — needs real Supabase credentials, see below.*
- *Dashboard's "Net income", "Mileage saved", "Clients", and "Documents" cards now pull real data and link through to their respective pages (4-column grid); Net income and Mileage saved both link to `/transactions` since that page covers both.*
- **Supabase migration is code-complete but unverified** — waiting on real project credentials (see "Local Development" below). `getSupabaseAdmin()` in `src/lib/supabase.ts` constructs its client lazily on first use specifically so the app still builds and every other route still works with those env vars unset; only document upload/download/delete will fail until they're added.
- *PDF export at `GET /api/reports/pdf?year=YYYY` (V1 key deliverable): leads with a net income/loss summary card row (Income, Expenses, Mileage deduction, Net), then itemized breakdowns — income transactions, expenses grouped by category with subtotals, and mileage trips with date/note/miles/rate/deduction — so an accountant can see exactly how each number was calculated. Built with `@react-pdf/renderer` (`src/lib/pdf/financial-report.tsx`) rather than a headless-browser approach (e.g. Puppeteer) — lighter weight and no binary/cold-start concerns on Vercel serverless. "Download PDF report" button lives next to the year selector on `/transactions`. Note: `renderToBuffer`'s TypeScript types require a cast when passing a wrapper component instead of a bare `<Document>` element — see the comment in `src/app/api/reports/pdf/route.ts` if this trips up a future edit.*
- Team invites / adding teammates to an existing team is **not built** — that's Platform Expansion Phase 2 now (was V2 "Team features activation," superseded — see above). Today, signing up with "Start a team" only creates the team and its first `TEAM_LEAD`.
- The seeded `MileageRate` row (`prisma/seed.ts`) is $0.725/mile (MI, 2026) — confirmed by the founder. Update this row (and re-run `npx prisma db seed`) whenever the IRS standard mileage rate changes; `getMileageRate()` falls back to the most recent prior-year rate if the exact year isn't seeded yet, so adding next year's row is a one-line change, not a code change.
- Shared UI primitives now live in `src/components/ui/`: `button.tsx`, `field.tsx`, `select.tsx`, `summary-card.tsx`, `textarea.tsx`, `year-select.tsx`. Reuse these for the PDF export UI rather than redefining per-page — this is exactly the pattern `/transactions`, `/clients`, and `/documents` all follow.
- The top nav (`src/app/(app)/layout.tsx`) has 5 links plus name/sign-out (Dashboard, Finances, Clients, Documents, Account) — the mileage tracker was merged into `/transactions` (now labeled "Finances" in the nav) rather than getting its own top-level link, both to keep income/expense/mileage tax-time data in one place and to keep the nav from growing further. Still worth a design pass (e.g. a sidebar) before adding more top-level sections.

## Local Development
- **Database (migrating to Supabase, 2026-07-16):** decided to move off local Postgres to a Supabase-hosted project for both dev and prod, so there's one connection story instead of "local now, something else at deploy time." To finish wiring this up:
  1. Create a project at supabase.com (external account — only the founder can do this).
  2. From Project Settings → Database → Connection string, copy the **Transaction pooler** string into `DATABASE_URL` and the **direct** connection string into `DIRECT_URL` in `.env.local`. (Prisma migrations need the unpooled `DIRECT_URL`; see the comment in `prisma/schema.prisma`.)
  3. From Project Settings → API, copy the **Project URL** into `SUPABASE_URL` and the **service_role key** into `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. The service-role key is server-only and bypasses RLS — never expose it to the client.
  4. Run `npm run supabase:setup` once (`scripts/supabase-setup.mjs`) to create the private `documents` storage bucket.
  5. Run `npx prisma migrate deploy` (or `migrate dev` for further schema changes) against the new database.
  - Until these env vars are set, everything except document upload/download/delete works normally (see "Supabase migration is code-complete but unverified" above).
  - **Legacy local Postgres** (superseded, not yet removed): a local PostgreSQL 17 instance can still run from `%LOCALAPPDATA%\RealtyLabzPg\` (binaries in `17.5\`, data in `data\`) on `127.0.0.1:5433`, started/stopped via `npm run db:start` / `npm run db:stop` (`scripts/db-start.ps1` / `scripts/db-stop.ps1`, wrapping `pg_ctl`; superuser `postgres`/`postgres`, dev-only). These binaries came from Maven Central's zonky embedded-postgres package, not the official EDB installer — the EDB installer's CDN (`get.enterprisedb.com`) returned 403 in this environment. Remove this whole setup (scripts + `%LOCALAPPDATA%\RealtyLabzPg\`) once Supabase is confirmed working end-to-end.
- **Env vars:** `.env.local` (gitignored) holds `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. `prisma.config.ts` loads `.env.local` explicitly (not the Prisma-default `.env`).
- **Prisma:** schema at `prisma/schema.prisma`, client generated to `src/generated/prisma` (gitignored, regenerate with `npx prisma generate`). Prisma 7's client generator requires a driver adapter — see `src/lib/db.ts` for the shared `PrismaClient` singleton using `@prisma/adapter-pg`. Run `npx prisma migrate dev` for schema changes, `npx prisma db seed` to re-seed.
- **Routing convention:** this Next.js version (16.2.10) renamed `middleware.ts` to `proxy.ts` (defaults to the Node.js runtime, which is required here since the Prisma-based auth check can't run on the Edge runtime) — see `src/proxy.ts`, not `middleware.ts`.

## Known Pain Points to Avoid (from competitor research — SkySlope)
- Buggy text box / signature field behavior in contracts — be extra careful with form field and e-signature implementation and testing.
- General reliability glitches — prioritize stability over feature count for document/contract handling specifically.

## Privacy & Compliance Notes
- Tax rules are Michigan-specific for now — clearly scope this in the UI so users don't assume multi-state support.
- No location data is collected in v1 (mileage is manually entered) — revisit privacy/consent/storage requirements when the native app phase adds GPS tracking.

## Working Style Notes for Claude
- **Stay local-only until told otherwise (confirmed 2026-07-17).** Keep developing and testing against `localhost:3000` (local dev DB or a Supabase dev project) — no deploying to Vercel, no pushing to a public GitHub remote — until the founder explicitly says it's time to go online. This is a standing instruction, not scoped to any one feature.
- **Quality and user-friendliness (the "Apple" bar above) is a first-class priority — weigh it alongside cost-consciousness, not after it.** When a cheaper/faster technical option would visibly hurt UX or design quality, flag the tradeoff rather than silently picking the cheap option.
- Keep suggestions cost-conscious (free/low-cost tiers, minimal third-party services) unless told otherwise.
- Default to simple, maintainable patterns over premature optimization — this is an MVP.
- When in doubt about a feature's priority, check the V1 vs V2 list above before building it; once V1 is complete, check the Platform Expansion Roadmap's phase order (finish each phase before starting the next — don't jump ahead to Phase 3 AI features while Phase 2 deal-tracking is unbuilt, for example).
- Maintain compatibility with the stated stack — Next.js/React, Vercel, GitHub, Supabase (DB + Storage only, not Auth) — rather than introducing alternatives. Build every new multi-tenant feature (Phase 2+) with the application-layer tenant-isolation pattern described in Architecture Principles; treat role-based permission checks as a security requirement, not an afterthought, especially anywhere a `BROKER`/`ADMIN` can see across agents.

@AGENTS.md

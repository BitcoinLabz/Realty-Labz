# Realty Labs — Project Guide for Claude Code

## Overview
Realty Labs is a web application built for real estate agents (starting with Michigan) to manage their business finances, mileage/tax deductions, and client documents in one place. It's designed to eventually support teams (brokerages), but launches as an individual-agent tool.

**Founder context:** Built by a working Michigan realtor who wants a lean, low-cost MVP first, with an eye toward pitching this to their brokerage for team-wide use later.

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
- **Frontend + Backend:** Next.js (App Router)
- **Database:** PostgreSQL
- **Hosting:** Vercel
- **Version Control:** GitHub
- **Auth:** TBD — recommend NextAuth.js (Auth.js) for simplicity and cost (free tier friendly)
- **UI:** Tailwind CSS + a small set of consistent, accessible primitives (e.g. shadcn/ui as a base) — favor a restrained design system over ad-hoc styling, in service of the Apple-like quality bar above.

## Architecture Principles
- Keep infrastructure costs near zero until the app has proven traction.
- Build with a `users` → `teams` relationship from day one (roles: `agent`, `team_lead`, `admin`), even though v1 only needs individual-agent functionality. Do not hardcode single-user assumptions.
- Web-first, fully responsive — no native mobile or desktop app for v1. Mobile wrapping (React Native/Expo) is a possible future phase, not now.
- Michigan-only tax/mileage rules for v1. Store state-specific rates/rules (e.g., mileage deduction rate) in a config/table that's easy to update annually and easy to extend to other states later — not hardcoded in logic.

## Core Data Model (initial draft)
- **users** — agent accounts, auth info, role, team_id (nullable for solo agents)
- **teams** — optional grouping for brokerages/team features (v2 activation)
- **clients** — belongs to a user; contact info, notes
- **properties/listings** — optional, tied to clients
- **transactions** — income/expenses; category field (mileage, home office, phone, other); tied to user
- **mileage_logs** — trip records: date, distance (miles, manually entered), business/personal flag, note (e.g. client name/purpose), calculated deduction amount (rate × miles at time of trip)
- **documents** — contracts/PDFs; tied to client and/or user; supports e-mail-a-link-to-client flow for client-filled info (v2)

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
- AI-powered image editor for listing photos
- Expanded export options (Excel, CSV in addition to PDF)
- Email-a-link contract flow — client fills in their own info remotely (SkySlope-style, but aiming for fewer bugs, especially around signature fields)
- Team features activation (shared client/document access, team lead reporting dashboard)
- CRM-style notes per client
- Leads tracker with follow-up reminders

## Known Pain Points to Avoid (from competitor research — SkySlope)
- Buggy text box / signature field behavior in contracts — be extra careful with form field and e-signature implementation and testing.
- General reliability glitches — prioritize stability over feature count for document/contract handling specifically.

## Privacy & Compliance Notes
- Tax rules are Michigan-specific for now — clearly scope this in the UI so users don't assume multi-state support.
- No location data is collected in v1 (mileage is manually entered) — revisit privacy/consent/storage requirements when the native app phase adds GPS tracking.

## Working Style Notes for Claude
- **Quality and user-friendliness (the "Apple" bar above) is a first-class priority — weigh it alongside cost-consciousness, not after it.** When a cheaper/faster technical option would visibly hurt UX or design quality, flag the tradeoff rather than silently picking the cheap option.
- Keep suggestions cost-conscious (free/low-cost tiers, minimal third-party services) unless told otherwise.
- Default to simple, maintainable patterns over premature optimization — this is an MVP.
- When in doubt about a feature's priority, check the V1 vs V2 list above before building it.

@AGENTS.md

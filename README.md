# PLR Champion Software Suite

A private, single-owner web application for turning Private Label Rights (PLR) content into finished, branded products — and planning how to sell them. One login, one shared project system, 22 tools in six studios, plus a dashboard and workspace pages.

It runs as a Next.js app (designed for Vercel). Your work is stored in your browser's private database (IndexedDB), never on a third-party cloud database. AI is optional and runs through your own Anthropic API key, stored only on the server.

> **Deploying it?** Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — every step uses the GitHub and Vercel websites; no terminal.
> **What is finished and what isn't?** See [docs/STATUS.md](docs/STATUS.md).

---

## What's inside

| Studio | Tools |
| --- | --- |
| **Dashboard** | Active project, the 12-step PLR workflow with real progress, recent work, workspace stats, studio launcher |
| **Content Studio** | **PLR Editor** (DOCX/PDF/TXT/MD/HTML import, chapter detection, rich editing, find & replace rules, versions, side-by-side compare with the original, DOCX/PDF/MD/HTML/TXT export) · **AI Writer** · **Rebrand Assistant** · **Outline Generator** |
| **Design Studio** | **Cover Creator** (templates, layered editor, undo/redo, PNG/JPG/PDF) · **Mockup Studio** (3D book, paperback, workbook, tablet, laptop, bundles — PNG/JPG) · **Brand Kits** |
| **Product Studio** | **Product Builder** · **Bonus Builder** · **Lead Magnet Creator** (workbooks, checklists, cheat sheets, mini-courses, action plans, resource lists and more, built from your own chapters) · **Opportunity Scanner** |
| **Research Studio** | **Niche Research** · **Keyword Finder** (pattern ideas, CSV metrics import with source labels, clustering) · **PLR Rights Review** (licence import, clause finder, warnings) |
| **Marketing Studio** | **Sales Page Builder** (sections, live preview, standalone HTML export) · **Email Swipe Builder** (6 sequence types) · **Social Content Creator** (calendar) · **Product Name Generator** |
| **Profit Studio** | **Profit Calculator** (scenarios, break-even, actual sales kept separate) · **Funnel Planner** (visual map, projections) · **Launch Planner** (tasks, milestones, templates, .ics calendar) · **Product Portfolio** |
| **Memberships** | **PLR Champion** (`/m/plr-champion`) and **PLRforIM** (`/m/plrforim`) member areas, each with its own branding and library — product library, categories, advanced search, product pages, Download Manager, My Downloads, Training Centre, courses, resources, monthly drops and the studio tools; **Membership Admin** for products, categories, releases, training, resources and members & access (bundles, linked accounts, test profiles). See [docs/MEMBERSHIP.md](docs/MEMBERSHIP.md) |
| **PLR Profit Lab** | `/m/plr-profit-lab` — **90-Day Profit Path** (personalised 13-week plan with daily tasks, milestones, progress and launch checklists), **Monthly Profit Campaign Drop** (Campaign Drop Creator, built from a PLR Editor project if you like, with a member preview and downloadable kit) and **PLR Profit Build Day** (workshop planner with agenda, resources, materials, checklists, action items and member progress). See [docs/PROFIT-LAB.md](docs/PROFIT-LAB.md) |
| **Workspace** | **Projects** (create, edit, duplicate, archive, trash/restore, snapshots) · **Export Centre** (ZIP product packages, workspace/project backups and restore, export history) · **Settings** |

Every tool works without AI, using templates, your source content and manual editing. When an Anthropic key is configured, AI buttons appear alongside — streaming output, model choice, token usage and estimated cost per request, and an approval step before anything replaces saved content.

### Ground rules the software follows

- **No fake data.** No invented search volumes, competition scores, CPCs, testimonials, results or income claims. Keyword metrics only appear when you import them from a CSV, and each value shows its source.
- **Estimates are labelled.** Price suggestions, opportunity ratings, projections and funnel numbers are marked as estimates or hypotheses. Profit projections are kept visibly separate from actual recorded sales.
- **No legal determinations.** The Rights Review finds and highlights clauses for you to read; it never decides what the licence allows and never assumes Master Resell Rights are included.
- **Nothing is overwritten silently.** AI output and bulk changes need explicit approval, and a version is saved first.
- **No hidden costs.** AI only runs when you configure your own key and press a button. No other paid service is used.

---

## Architecture

```
Browser (Next.js client)                                 Server (Next.js on Vercel)
┌───────────────────────────────────────────┐            ┌───────────────────────────────────────┐
│ Tools (src/features/*)                    │            │ middleware.ts  – login gate, CSRF,    │
│   │                                       │            │                  origin checks        │
│   ▼                                       │            │ /api/auth/*    – login, logout,       │
│ Services (src/lib/services, lib/*)        │  fetch     │                  session (signed JWT) │
│   │  pure logic: builders, calculators,   │ ─────────▶ │ /api/ai/*      – AIProvider →         │
│   │  exporters, renderers                 │            │                  Anthropic (key only  │
│   ▼                                       │            │                  on the server)       │
│ Repositories (src/lib/data/repositories)  │            │ /api/keywords/metrics – optional      │
│   ▼                                       │            │                  metrics provider slot │
│ Dexie / IndexedDB (src/lib/data/dexie.ts) │            └───────────────────────────────────────┘
└───────────────────────────────────────────┘
```

- **Next.js 15 App Router**, React 19, TypeScript (strict), Tailwind CSS v4, Radix UI primitives.
- **Persistence:** IndexedDB via Dexie behind repository interfaces. Tools never touch IndexedDB directly, so a server database can replace it later — see [docs/DATABASE-MIGRATION.md](docs/DATABASE-MIGRATION.md). Schema version 1; backups carry the version and are migrated on restore.
- **Shared project model:** every piece of work is an `Asset` of a typed kind (document, cover, mockup, sales page, funnel…) inside a `Project`. Versions, snapshots, trash, duplication, backup and ZIP export work the same way for every tool.
- **Auth:** single owner password from environment variables (plain or PBKDF2 hash), HS256-signed session in an HttpOnly, Secure, `__Host-` cookie, double-submit CSRF token plus Origin checks on every API write, login throttling with lockout. No registration, no user accounts.
- **AI:** an `AIProvider` interface with an Anthropic implementation (server-side streaming, NDJSON to the browser). Each task has a schema, prompt builder and output limits. Usage (tokens, estimated cost) is logged locally.
- **Security headers:** strict Content-Security-Policy (no third-party scripts or fonts), frame denial, `noindex`.
- **Exports:** DOCX (`docx`), PDF (`pdfmake` / `jsPDF`), PNG/JPG (Canvas/Konva), HTML, Markdown, CSV, iCalendar, ZIP (`jszip`).

### Folder guide

```
src/app/            routes: (app)/<tool>/page.tsx, (member)/m/[brand]/*, /login, /api/*
src/features/       one folder per studio — the tool UIs
src/components/     shell (sidebar, header), shared UI, charts
src/lib/data/       types, repository interfaces, Dexie implementation, React hooks
src/lib/services/   project/asset/version/backup/storage services, sample project
src/lib/membership/ membership data model, brand config, access rules, search, catalogue, backup, sample library
src/lib/lab/        PLR Profit Lab: Profit Path generator, campaigns, Build Days, sample content
src/lib/integrations/ BYLDITY payloads and connector contract (not connected)
src/lib/ai/         provider interface, Anthropic provider, tasks, prompts, model catalogue
src/lib/auth/       password hashing, sessions, throttling, config checks
src/lib/<domain>/   doc, import, export, covers, mockups, content, research, marketing, profit
tests/unit/         Vitest unit tests
tests/e2e/          Playwright browser tests (+ fixtures)
docs/               deployment, status report, testing checklist, migration plan
```

---

## Checks

All checks run automatically on GitHub after every push (**Actions** tab) via `.github/workflows/ci.yml`: type check, lint, unit tests, production build and the full browser test suite. See [docs/TESTING-CHECKLIST.md](docs/TESTING-CHECKLIST.md) for the manual checklist.

For developers who do use a terminal, the equivalent commands are `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e` (`npm run check` runs the first four).

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploy with GitHub + Vercel (no terminal), environment variables, AI key, updates, backups
- [docs/STATUS.md](docs/STATUS.md) — completed features, what is not implemented, what was not tested
- [docs/TESTING-CHECKLIST.md](docs/TESTING-CHECKLIST.md) — automated coverage and a manual checklist per tool
- [docs/MEMBERSHIP.md](docs/MEMBERSHIP.md) — the PLR Champion and PLRforIM membership areas and their admin
- [docs/PROFIT-LAB.md](docs/PROFIT-LAB.md) — PLR Profit Lab: 90-Day Profit Path, Campaign Drops and Build Days
- [docs/DATABASE-MIGRATION.md](docs/DATABASE-MIGRATION.md) — plan for moving from browser storage to a server database later
- [.env.example](.env.example) — every environment variable, explained

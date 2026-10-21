# Testing checklist

## Automated checks

All of these run on GitHub after every push (**Actions → Checks**). Last full local run: everything passed.

| Check | What it covers |
| --- | --- |
| Type check | TypeScript strict mode across the whole app |
| Lint | ESLint (Next.js + TypeScript rules), zero warnings |
| Unit tests | 121 tests in 11 files (Vitest) |
| Production build | `next build` of all 26 studio pages (22 tools, dashboard, workspace pages), 28 membership pages (shared by both brands), the login page and the API routes |
| Browser tests | 49 end-to-end tests in a real Chromium browser (Playwright) against the production build |

### Unit tests (`tests/unit`)

- **data** — create/update/list assets; soft delete, restore and cascade purge; project duplication with remapped references and copied files; duplicate detection; asset version restore with a pre-restore copy; whole-project snapshot restore; workspace backup round-trip including files; importing a project backup as a copy; invalid-backup rejection; sample seeding once, recovery from an interrupted first run, and no sample next to real work or after a replace restore.
- **doc** — chapter splitting (H1/H2, preface, title detection, Word "Title"/Heading 1 titles), chapter-like paragraph detection, merge/split, find & replace across formatting, whole-word/case rules, rule order, Markdown/HTML export safety, word counts, change percentage.
- **builders** — every Product/Bonus/Lead-magnet format builds from real source chapters; verb-first action detection; refuses to build without sources.
- **opportunities** — core-topic detection, labelled opportunity suggestions, AI ideas never receive an invented score.
- **research** — pattern keywords have no metrics; CSV import with column mapping records its source; clustering; rights clause finder flags restriction words; MRR is never assumed.
- **marketing** — sales templates contain no testimonials or income claims; HTML export escapes content and only links http(s) checkout URLs; email sequences in order without fake urgency; social posts and Monday-first calendar.
- **profit** — revenue/cost/profit arithmetic, break-even, actual sales summarised separately, funnel flows (yes/no/next), loop and orphan warnings, launch dates/progress, iCalendar export, template round-trip.
- **auth** — PBKDF2 hashing and verification, hash preferred over plain password, signed sessions reject tampering/other secrets/old versions, login lockout and reset, config problems reported without exposing values, `__Host-` cookies.
- **workflow** — the 12-step project workflow counts only real, non-trashed work.
- **brands** — both brands switched on with their own theme; separate sample libraries with valid categories and drops; no income claims in sample text; seeding, removal and backup restore never touch the other brand; entitlements from own membership, bundles and linked accounts (both directions, one hop); test profile validation, linking, preview and clean-up.
- **membership** — access rules (tiers, drafts, scheduled items, owner preview), library search ranking/filters/URL round-trip, unique slugs, category clean-up, releases kept in step with products, scheduled vs published releases, attachments and duplicate/delete file clean-up, safe links, sample library seeded once and removable without touching your own products, favourites and lesson progress, licence summaries, membership backup round-trip and brand isolation, cover text escaping, course progress, embedded tool link remapping.

### Browser tests (`tests/e2e`)

- **PLRforIM** — own branded dashboard, theme and library (no PLR Champion products), ZIP licence summary names PLRforIM, IM drops; brand switcher keeps the section in both directions; test profiles: an IM-only buyer is refused PLR Champion and sees member-level IM content, linking a PLR Champion account shares access both ways, a bundle buyer gets premium on both; a PLRforIM backup is refused by PLR Champion.

- **Membership** — dashboard; library search; product page single-file and ZIP downloads with licence summary; My Downloads and download again; Advanced Search licence/category filters surviving a reload; Download Manager multi-product ZIP (valid PDF and DOCX inside); Edit in PLR Editor (and blocked for an MRR licence); View as free member (drafts hidden, member items locked, admin hidden); admin creates a category and a product with cover, file and licence then publishes it; admin schedules a monthly release; lesson completion and checklist ticks persist; membership backup and restore; phone-width layout of 15 member and admin pages; studio link and unknown-brand 404.

- **Private access** — redirect to login, wrong password rejected, sign in, session kept across reloads, sign out; API rejects unauthenticated and cross-site requests.
- **Editor views** — on a phone-sized screen a PDF that splits into 3 chapters shows all of them; next/previous and the chapter list jump between them and the bar follows scrolling; typing in chapter 3 makes it the active chapter and is saved; one-chapter view with previous/next at the end of each chapter, remembered after a reload; on a computer the toolbar formats the chapter being edited, the side list scrolls to a chapter, and a chapter added at the end can be named.
- **Content Studio** — DOCX and text-based PDF import (also in a Safari-like browser) with 3 detected chapters → edit → autosave → reload persists → compare with original → DOCX, PDF and Markdown exports are valid files containing the edit; AI Writer (templates + AI provider + usage display); Outline Generator → document; sample document opens.
- **Design Studio** — cover from template, edit, undo, PNG and PDF export; mockups from the sample cover with real PNG export; brand kit created and linked to a project.
- **Product Studio** — workbook built from source chapters, saved and exported; Bonus Builder AI draft split into parts; Opportunity Scanner labels estimates and hands off to a builder; Lead Magnet matching cover.
- **Research Studio** — Keyword Finder patterns, CSV metrics with source, clustering, CSV export; Rights Review licence import, clause finder, MRR warning, reviewed state; Niche Research keeps AI suggestions labelled as hypotheses.
- **Marketing Studio** — Sales Page templates, disable/enable sections, live preview, approval before AI replaces text, HTML export; Email Swipe sequence order and CSV; Social posts and calendar scheduling; Name Generator favourites and apply-with-confirmation.
- **Profit Studio** — Profit Calculator arithmetic with actuals kept separate (persists after reload); Funnel Planner projections and versions; Launch Planner progress, auto-checked steps and .ics export; Portfolio CSV.
- **Workspace** — project create/edit/duplicate/archive/trash/restore; snapshot restore (form refreshes and survives reload); Export Centre ZIP package and full backup → restore as copies; Settings AI test, preference persistence, storage report, password-hash generator; Dashboard shows the real workflow.

AI in automated tests uses a built-in test provider that returns text marked `[TEST OUTPUT]`. **The real Anthropic connection is not covered by automated tests** — use the manual AI checks below once your key is configured.

---

## Manual checklist (after deploying)

Tick each item on your live site. Use a fresh project (not the sample) for the end-to-end run.

### Access & security
- [ ] Opening any page while signed out goes to the login page.
- [ ] A wrong password is rejected; after 5 wrong attempts the login is locked for a while.
- [ ] The right password signs in; refreshing keeps you signed in; **Sign out** (Settings → Account) works.
- [ ] In a private window, the site shows only the login page.

### Projects & data safety
- [ ] Create a project, edit its details, reload — details kept.
- [ ] Duplicate, archive, move to Trash and restore a project.
- [ ] Save a snapshot, change something, restore the snapshot.
- [ ] **Export Centre → Download full backup** downloads a `.json` file. Restore it **as copies** — the projects reappear alongside the originals.
- [ ] **Settings → Storage** shows usage. Click **Ask the browser to keep my data**.

### Content Studio
- [ ] Import one of your real PLR files (DOCX and PDF). Chapters are detected sensibly; adjust if needed.
- [ ] On your phone, after the import the whole document shows, chapter after chapter. The bar above it jumps to any chapter (tap the chapter name), goes to the previous / next one, and switches between **All** (whole document) and **One** (one chapter at a time, with Previous / Next at the end of each chapter). Type in a later chapter, reload — the edit is kept and the view you chose is remembered.
- [ ] Edit text, wait for "Saved", reload — edit kept. Compare view shows the original.
- [ ] Add find & replace rules (e.g. old author name → yours), preview, apply; check Version history has a pre-change version.
- [ ] Export DOCX and PDF; open both in Word / a PDF reader.
- [ ] AI Writer, Rebrand Assistant and Outline Generator work with templates (no AI).

### Design Studio
- [ ] Create a brand kit with your logo, colours and fonts; link it to the project.
- [ ] Create a cover from a template; change text, colours and image; undo/redo; export PNG and PDF.
- [ ] Create a 3D book mockup and a bundle; export PNG.

### Product Studio
- [ ] Build a checklist or workbook from your chapters; save as a document; export it.
- [ ] Bonus Builder and Lead Magnet Creator produce content from your source; create a matching cover.
- [ ] Opportunity Scanner shows ideas labelled as estimates; "Build this" opens the right builder.

### Research Studio
- [ ] Rights Review: paste or import your licence; clauses are highlighted; record your own reading of each right (allowed, not allowed, conditional, unclear); mark reviewed.
- [ ] Keyword Finder: generate pattern ideas (no metrics shown); import a CSV export from your keyword tool — metrics appear with the file name as source; export CSV.
- [ ] Niche Research: notes and scores save; anything AI suggests is labelled as a hypothesis.

### Marketing Studio
- [ ] Sales page from template; preview; set a checkout URL; export HTML and open it in a browser.
- [ ] Email sequence; reorder; export CSV and copy an email.
- [ ] Social posts; schedule on the calendar; export.
- [ ] Name ideas; favourite one; apply it to the project (confirmation shown first).

### Profit Studio
- [ ] Profit Calculator: enter price/costs — check one result by hand. Record an actual sale — it appears separately from projections.
- [ ] Funnel Planner: add steps, connect yes/no paths, see projected numbers labelled as hypothetical; save a version.
- [ ] Launch Planner: pick a template, set a launch date, tick tasks; export the `.ics` and import it into your calendar.
- [ ] Portfolio lists your products; CSV export opens in a spreadsheet.

### Export
- [ ] Export Centre → build a ZIP package for the project; open it — folders, README and files are present.

### AI (only if `ANTHROPIC_API_KEY` is set)
- [ ] Settings → AI → **Test connection** replies and shows the model and estimated cost.
- [ ] In the PLR Editor, select a paragraph and run an AI rewrite: output streams in; nothing replaces your text until you approve; a version is saved before applying.
- [ ] Generate with AI in one tool per studio (e.g. AI Writer, Bonus Builder, Niche Research, Sales Page). Each response shows tokens and estimated cost.
- [ ] Click **Stop** on a running AI request — it stops and nothing is applied.
- [ ] Settings → AI usage log lists the requests; compare totals with the Anthropic Console after a day.

### Membership (`/m/plr-champion`)
- [ ] Open **Memberships → PLR Champion Members** from the studio sidebar. The first visit prepares the sample library (a progress bar shows) and lands on the member dashboard.
- [ ] Library: search, category pills, grid/list views, save a product with the heart, then filter **Saved products only** in Advanced Search.
- [ ] Product page: download one file, download everything as a ZIP — open the ZIP and check each product folder has `LICENCE-SUMMARY.txt`.
- [ ] **Edit in PLR Editor** on a DOCX — it opens as a new project inside the member area with chapters split.
- [ ] Download Manager: tick three products, download the ZIP; then **My Downloads** lists it and *Again* works.
- [ ] Training: complete a lesson, tick a checklist item, reload — progress is kept.
- [ ] **View as → Free member**: drafts and next month's drop disappear, member/premium products show a lock and their downloads are disabled; *Exit preview* restores admin.
- [ ] Admin → Products → **New product**: add a title, description, category, cover image, a DOCX and a licence file, set the access level and **Publish now**. Find it in the library.
- [ ] Admin → Releases: create next month's release, tick products, **Schedule release**. It shows as scheduled; members only see a "coming" teaser.
- [ ] Admin → Data: download a membership backup, remove the sample content, restore the backup with **Merge**.

### PLRforIM (`/m/plrforim`) and access
- [ ] Open **Memberships → PLRforIM Members**: teal/orange branding, “Monthly IM Drops”, an internet-marketing library — none of PLR Champion's products.
- [ ] Use the brand button (next to **View as**) to jump between brands; you stay on the same page type.
- [ ] Admin → **Members & access** → create an “IM only” test profile (PLRforIM: Member). **View as** it, then open PLR Champion — you get the “No PLR Champion membership” page.
- [ ] Create a “Champion buyer” (PLR Champion: Premium) linked to the IM profile; view as the IM profile again — PLR Champion opens.
- [ ] Create a bundle profile — both brands show Premium “via Bundle”.

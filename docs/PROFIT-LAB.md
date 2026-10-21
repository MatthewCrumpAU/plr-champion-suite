# PLR Profit Lab (Ecosystem Phase 4)

PLR Profit Lab is the hands-on implementation membership: where PLR Champion and PLRforIM supply the products, Profit Lab helps members **put PLR to work** — a personal 90-day plan, a done-for-you launch campaign every month, and a monthly workshop to get it finished.

| | |
| --- | --- |
| Address | `/m/plr-profit-lab` (studio sidebar → **Memberships → PLR Profit Lab**) |
| Look | Deep green and gold, path-and-flag mark |
| Modules | **90-Day Profit Path** · **Monthly Profit Campaign Drop** · **PLR Profit Build Day** |
| Also included | Training Centre, Courses & Tutorials, Member Resources and the embedded PLR Editor, Rebrand Studio, Product Builder and Profit Map |
| Not included | The PLR product library, Download Manager and monthly product drops — those belong to PLR Champion and PLRforIM. Their addresses show a "Not part of PLR Profit Lab" page here, and the Profit Lab addresses do the same inside the other two brands |

It is the third brand in the same membership system, so **View as**, test profiles, bundles, linked accounts, backups and the admin all work exactly as described in [MEMBERSHIP.md](MEMBERSHIP.md). It sits behind the owner login like everything else: no public sign-up, subscriptions, payments or hosted database.

---

## 1. 90-Day Profit Path (`/profit-path`)

### The questions
Five short steps, with a live preview of the plan they produce:

1. **Experience** — new, some experience, experienced. Beginners get about 25 % more time per task and a later first launch (week 7); experienced members about 20 % less (week 4).
2. **Working hours** — hours a week (1–80), which days they can work, and the start date (day 1 of 90).
3. **What you have** — niche, first product idea, PLR products owned, products already sold, email list (and its size), website, checkout, social following, and optionally a studio project to build the plan around.
4. **Business model** — sell rebranded products, lead magnet + email funnel, paid membership, bundles, resell PLR packages, or products that lead to services.
5. **Launch goals** — 1–3 launches, the week of the first launch (3–11), revenue goal, price, email-list goal and a what-if conversion rate. The page shows the maths (sales and visitors needed) labelled as *example maths, not a forecast or a promise of results*.

### The plan
`src/lib/lab/profit-path.ts` turns the answers into a 13-week plan — deterministically, with no AI and no network:

- **Stages:** Foundations → Create → Prepare to launch → Launch → Review & improve → Grow → Next product (before each extra launch) → 90-day review. Extra launches are spaced at least three weeks apart and finish by week 12.
- **Tasks** come from a task library (`path-templates.ts`) and only appear when they apply — e.g. *set up an email tool* only if there's no list, *build the opt-in page* only for funnel and membership models, *resell-rights licence* only for PLR resellers. Titles use the member's own answers ("Confirm your niche: Busy parents").
- **Fitting the week:** every task is *core*, *recommended* or *stretch*. Core tasks always stay; recommended and stretch tasks are scheduled only while they fit the member's hours, and the rest appear under "If you have extra time". Weeks whose core work is over the hours available say so.
- **Days:** tasks are spread across the member's working days; launch-day tasks are anchored around the middle working day of launch week.
- **Launch checklists** (seven days before, launch day, after launch) for each launch.
- **Stable task keys** — changing an answer re-plans instantly and every ticked task stays ticked.

### What members do with it
| Tab | |
| --- | --- |
| **Today** | Today's tasks, earlier tasks to catch up on, this week's milestone, and links to the Campaign Drop and Build Day. Before the start date it previews week 1; after day 90 it shows the final result |
| **This week** | Day-by-day tasks, extras, skipped tasks, focus, milestone, hours planned vs available, and a **weekly reflection** (saved when you click away) |
| **13 weeks** | A colour-coded strip and a card per week with its milestone and progress |
| **Launch checklists** | Each launch's checklist with progress |
| **Your answers** | Edit any answer, then **Save and re-plan**; clear progress or delete the plan |

Also: tick tasks (with streak, milestones and on-track / ahead / behind status), **Add a task** of your own on any day, **Skip** a task that doesn't apply (the week re-plans), and **Export** the plan with ticks as Markdown, the tasks as CSV, or an `.ics` calendar with one entry per working day plus launch days. Each task can link to the tool where it's done.

### Owner set-up in private testing
**Admin → Profit Path profiles** lists you and every test profile with Profit Lab access, their plan summary and progress. **Set up plan / Open plan** switches *View as* to that profile and opens their Profit Path, so you answer the questions and tick tasks as them; everything is saved under their profile. Create more test profiles in **Members & access** (give them PLR Profit Lab access or the *Complete PLR Business bundle*).

---

## 2. Monthly Profit Campaign Drop (`/campaigns`)

### Campaign Drop Creator (Admin → Campaign Drop Creator)
- **Start from a template** for a month, or **Create from a PLR Editor project**: the project's main document becomes the featured product as a DOCX file (chapter titles become the contents and its find-and-replace rules become rebrand rules), and the project's own sales page, emails, social posts, lead magnet and bonus documents and launch plan are brought across. Anything missing is filled with editable template copy written from the product. A cover is generated.
- **Ten sections**, each with a ready / not ready mark:
  1. **Featured PLR product** — title, subtitle, format, description, contents, files (any type, up to 200 MB each), licence notes
  2. **Rebranding instructions** — steps plus find-and-replace rules for the Rebrand Assistant
  3. **Product positioning** — audience, problem, promise, angle, price, offer stack
  4. **Sales-page copy** — the Sales Page Builder's sections, editable, reorderable and switchable
  5. **Email marketing sequence** — launch emails with send days relative to launch day
  6. **Social media content** — posts per platform and day, with hashtags
  7. **Lead magnet** — title, format, outline and file
  8. **Bonus materials** — any number, each with files
  9. **Launch checklist** — prepare / pre-launch / launch day / after launch, optionally dated
  10. **Promotional calendar** — built from the emails, posts and dated checklist steps; your own entries are kept when you rebuild it
- **Regenerate from template** per section (asks first), **Duplicate** to next month (files copied), **Delete** (files removed).
- **Release now** or **Schedule** for a date; access level per campaign; **Member preview**; download the whole kit.
- Template copy follows the studio's rules: [placeholders] for anything only the member knows, and no testimonials, results, income claims or fake scarcity.

### What members see
- A list of released campaigns (newest first, this month highlighted, a "coming" teaser for scheduled ones) with launch-step progress.
- Each campaign: a **What's included** grid of all ten parts, then every section in full — file downloads, copy buttons for each email and post, sales copy as Markdown or a standalone HTML page, the checklist to tick off, and the dated promotional calendar (`.ics` and CSV).
- **Download the campaign kit** — one ZIP with a README and a numbered folder per section (product files, sales page HTML/Markdown, emails CSV/Markdown, posts CSV, lead magnet, bonuses, checklist, calendar `.ics`/CSV).
- **Start it in the studio** — creates a studio project with the sales page, launch emails, dated social posts and a launch plan relative to the launch day, imports the featured product into the PLR Editor and opens it.
- Members below a campaign's access level see what's included but not the contents or downloads.

### BYLDITY handoff (prepared, not connected)
The editor's **BYLDITY handoff** panel shows what each campaign would send to **ByldSend** (the email sequence with send dates), **ByldPages** (the sales page HTML), **Byld Countdown** (a timer ending on launch day) and **ByldFlow** (a buyer-tagging and follow-up automation). Each payload can be downloaded as JSON. **Send** reports that the app isn't connected — no network request is made. `src/lib/integrations/byldity.ts` defines the payload types and the `ByldityConnector` contract; a real connector (server-side, with keys you configure) is registered with `registerConnector()` without touching the screens.

---

## 3. PLR Profit Build Day (`/build-days`)

### Build Day Planner (Admin → Build Day Planner)
- **Plan a Build Day** for a month — it starts with a proven agenda (welcome, teach, build sprint, break, hot seats, build sprint, share and commit) on the second Saturday at 10 am in your time zone.
- **Details:** title, theme, start date and time, host time zone, format (live online / in person / self-paced), host, venue, places, access level, outcome, banner.
- **Agenda builder:** sessions with real start times calculated from the durations; type, presenter, description, outcome, discussion prompts, and resources per session (uploaded files or links — https or an in-app page such as `/sales-pages`).
- **Materials** (workbooks, templates, slides), **implementation checklist** (before / on the day / after) and **action items** due a number of days after the day.
- **Links & community:** your own meeting link (Zoom, Meet…) and recording link — there is **no video streaming built in** — and community settings (stored for the future discussion feed; today the journal prompt is used).
- **Announce now** or schedule the announcement; **Plan next month** copies the agenda, checklist, actions and files to next month as a draft with links cleared.
- **Run the day:** host run sheet (Markdown), calendar invite (`.ics`), member pack (ZIP), and an **Attendees** panel with RSVPs, attendance and each person's progress.

### What members see
- The next Build Day with a live countdown, **RSVP** (going / maybe / can't make it) and add-to-calendar; other upcoming and past Build Days with progress.
- Each Build Day: date and times in the member's own time zone (and the host's if different), the join link while it's upcoming or live ("Join now" once live), the recording link once it's added, the agenda with the session running now highlighted, session resources, materials, the implementation checklist, action items with due dates plus **their own action items**, a private **wins journal**, "I took part", progress, and **Download everything** (ZIP).

---

## Sample content
On the first visit Profit Lab creates original sample content (all marked **Sample**):

- **3 campaigns:** last month (*The Sleep Better Launch*), this month (*The Weekend Side Hustle Launch*) and next month (*The Money Reset Launch*, premium, scheduled) — each with real DOCX/PDF product files, a lead-magnet PDF, bonus files and every section complete.
- **2 Build Days:** *Email Sequence Sprint* (last month) and *Launch-Ready in a Day* (upcoming), with workbooks, session resources, checklists and actions.
- **2 sample members** with their own Profit Path started last Monday: **Jordan** (new, 5 h a week, lead magnet funnel, member) and **Alex** (experienced, 20 h, bundles, three launches, premium on Profit Lab and PLR Champion).
- Training: *Getting Started with PLR Profit Lab* and a *Profit Path quick-start* tutorial; 5 resources.

*Admin → Data → Remove sample content* removes the sample campaigns, Build Days, training, resources and the two sample members with their plans and progress. *Recreate* brings them back.

## Access and bundles
- Profit Lab has its own memberships (free / member / premium). The Profit Path needs at least *member*; each campaign and Build Day has its own access level.
- The **Complete PLR Business bundle** grants premium on all three brands. The existing *PLR Champion + PLRforIM bundle* does **not** include Profit Lab, and linked accounts work as before.

## Storage and backup
Profit Lab records live in the same membership database (`plr-champion-membership`, Dexie schema version 2) in four new tables: `labProfiles`, `labProgress`, `campaigns`, `buildDays`. Files use the shared member file store. The brand's backup (format version 2) includes all four tables and their files; older version-1 backups still restore. Supabase table sketches: [DATABASE-MIGRATION.md → Profit Lab tables](DATABASE-MIGRATION.md#5-profit-lab-tables).

## Code map
| Path | |
| --- | --- |
| `src/lib/lab/types.ts` | Data model (one interface per future table) |
| `src/lib/lab/profit-path.ts`, `path-templates.ts`, `store.ts` | Plan generator, task library, profiles and progress |
| `src/lib/lab/campaigns.ts`, `campaign-studio.ts` | Campaign templates, calendar, validation, project ↔ campaign, exports and kit |
| `src/lib/lab/build-days.ts` | Agenda scheduling, progress, duplication, run sheet, `.ics`, pack |
| `src/lib/lab/dates.ts`, `ics.ts` | Local-date helpers and iCalendar writer |
| `src/lib/lab/sample-content.ts`, `seed.ts` | Sample content and seeding/removal |
| `src/lib/integrations/byldity.ts` | BYLDITY payloads and connector contract (not connected) |
| `src/features/lab/` | Member pages (dashboard, Profit Path, campaigns, Build Days) and `admin/` (overview, Campaign Drop Creator, Build Day Planner, Profit Path profiles) |
| `src/app/(member)/m/[brand]/{profit-path,campaigns,build-days}`, `…/admin/{campaigns,build-days,profit-paths}` | Routes (shown only for brands with the `lab` feature) |
| `tests/unit/lab-path.test.ts`, `lab-content.test.ts`, `tests/e2e/profit-lab.spec.ts` | Tests |

## Still to do before members can use it for real
- **Real member accounts, sign-up and payments** (excluded for private testing). Today the owner previews members with test profiles.
- **Member-facing studio tools.** The four embedded tools stay inside the membership area; other tools a task or campaign links to (Sales Page Builder, Email Swipe Builder, Launch Planner…) open the owner studio, and *Start it in the studio* creates projects in the owner's studio. Members will need their own workspaces or member versions of those tools. One Profit Path task links to the PLR Champion library, which only members with PLR Champion access can open.
- **Community features** for Build Days (shared wins, discussion under session prompts) — fields are stored; the journal is private until then.
- **BYLDITY connectors** — payloads and the contract are ready; connecting an app needs its API key configured on the server.
- **AI-written campaign copy** is not offered; campaigns use editable templates and the project's own copy.
- Member accounts are global, so a brand backup doesn't contain them: restoring Profit Lab's backup after removing the samples brings back the sample plans but not the two sample member accounts (recreate the samples to get them back).

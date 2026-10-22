# Memberships: PLR Champion, PLRforIM and PLR Profit Lab (Phases 2–4)

The membership areas are the customer-facing side of the ecosystem: premium member libraries with downloads, training, resources and the studio tools, plus an owner-only admin for loading products and organising monthly releases.

| Brand | Address | Look | Library |
| --- | --- | --- | --- |
| **PLR Champion** | `/m/plr-champion` | Indigo and gold, crown mark | General-niche PLR (health, money, family, home, business…), *Monthly Product Drops* |
| **PLRforIM** | `/m/plrforim` | Teal and orange, growth-chart mark | Internet-marketing PLR (list building, affiliate, traffic, social, launches), *Monthly IM Drops* |
| **PLR Profit Lab** | `/m/plr-profit-lab` | Green and gold, path-and-flag mark | No product library — the 90-Day Profit Path, Monthly Profit Campaign Drops and PLR Profit Build Days. See [PROFIT-LAB.md](PROFIT-LAB.md) |

Both use the same components and services, but each brand has its **own** products, categories, drops, training, resources, downloads, favourites, progress, backups and customers. The studio sidebar's **Memberships** section links to both. Like every other page they sit behind the owner login — there is no public sign-up, subscription, payment or member account system yet.

Everything below applies to PLR Champion and PLRforIM (swap `plr-champion` for `plrforim` in the addresses). PLR Profit Lab shares the shell, View as, Members & access, Training, Resources and Data & backup, but replaces the library areas with its own modules — they're described in [PROFIT-LAB.md](PROFIT-LAB.md). Each brand only shows the areas it offers; opening another brand's area shows a "Not part of …" page.

---

## What members see

| Area | Route | What it does |
| --- | --- | --- |
| Dashboard | `/m/plr-champion` | Welcome, counts, this month's drop, featured products, continue learning, recently added, recent downloads, tool shortcuts |
| PLR Product Library | `/library` | Grid or list of every product, category pills, search, sort, save-for-later hearts |
| Product Categories | `/categories` | Niche cards with product counts and what's available at your level |
| Advanced Search | `/search` | Full-text search (titles, descriptions, tags, file names, “quoted phrases”) plus filters for category, format, licence rights, access level, drop, editable files and saved products. Filters live in the URL, so a search can be bookmarked |
| Product preview page | `/library/<slug>` | Cover and preview images, highlights, description, every file with size and type, licence summary with each right, tags, related products. Download one file, download everything as a ZIP, save for later, or **Edit in PLR Editor** |
| Monthly Product Drops | `/drops`, `/drops/<id>` | Every released drop with its products; download a whole drop as one ZIP. Members see a “coming next” teaser for scheduled drops |
| Download Manager | `/downloads` | Tick any products (or a whole drop) and download them as one ZIP — a folder per product, each with `LICENCE-SUMMARY.txt` |
| My Downloads | `/my-downloads` | History of every file, bundle, resource and lesson download with “download again” |
| Training Centre | `/training` | Progress stats, continue where you left off, courses, tool tutorials with “Open tool” |
| Courses & Tutorials | `/courses`, `/courses/<id>` | Lesson player: articles, tickable checklists, downloads and links to externally hosted videos; mark complete; progress is saved |
| Member Resources | `/resources` | Templates, checklists, swipe files, guides and tool links |
| PLR Editor / Rebrand Studio / Product Builder / Profit Map | `/tools/*` | The studio tools inside the membership look and feel. Links between them stay inside the membership area |

**Edit in PLR Editor** copies the library file into a new studio project, splits it into chapters and opens it. The library copy is never changed. If the licence says editing isn't allowed the button is disabled; if it's conditional or not stated you're asked to check first.

## Owner tools

### View as… (access preview)
The **View as** button in the header switches between *Owner (admin view)*, *Premium member*, *Member* and *Free member*. While previewing, drafts and scheduled items disappear, admin links are hidden, and anything above that level is shown locked (“Member access required”) with downloads and editing disabled — exactly what that member would see. A banner shows the preview is on; **Exit preview** returns to the owner view.

### Switching brands
The brand button next to **View as** switches between PLR Champion and PLRforIM and keeps you in the same section (library → library, admin products → admin products). When previewing a test profile it only lists the brands that profile can open.

### Members & access (`/admin/access`) — prepared for bundle buyers
Shows every account in this browser and what it can open on each brand, and why:
- **Own membership** — the tier bought on that brand.
- **Bundle** — the *PLR Champion + PLRforIM bundle* grants premium on both; the *Complete PLR Business bundle* grants premium on all three brands including PLR Profit Lab.
- **Linked account** — the same person's account on the other brand; linked accounts share access both ways (one hop).

The highest tier wins. **New test profile** creates a local, sign-in-less profile (name, email label, tier per brand, bundle, links). **View as** on a profile shows the areas exactly as that customer would see them — a PLRforIM-only buyer gets a “No PLR Champion membership” page on PLR Champion with a link to PLRforIM. Nothing here signs anyone in; when memberships go live, real accounts use the same model (`src/lib/membership/entitlements.ts`).

### Membership Admin (`/m/plr-champion/admin`)
- **Overview** — live / scheduled / draft counts, storage used, products missing a cover, files, category or description, recently edited.
- **Products** — create, edit, duplicate, publish/unpublish, archive, delete. The editor autosaves and covers: title, subtitle, page address, format, description (Markdown with preview), highlights, tags; **files** (drag and drop, up to 200 MB each, type per file, word count measured from editable files); **licence** (type, each right as allowed / not allowed / conditions apply / not stated, conditions text, licence document); **publishing** (status, available-from date, access level, drop, featured); categories; cover and preview images.
- **Categories** — create, edit (name, description, icon, colour), reorder, delete (products are kept).
- **Releases** — create a release for a month, set title/theme/description/cover, tick the products in it (a product belongs to one drop), then **Release now** or **Schedule release** for a date and time. Releasing also publishes the drop's draft products on the same date.
- **Training** — courses and tool tutorials with modules and lessons (article, checklist, download, video link), attachments, level, access level, “Try it” tool.
- **Resources** — files or links (https or an in-app page such as `/profit`), type, access level, order.
- **Data & backup** — storage use, **download a membership backup** (one ZIP), **restore** it (merge or replace), remove or recreate the sample content, erase this brand's membership data.

## Sample content
On the first visit each brand creates its own original sample library so everything can be tested immediately. Product files are real DOCX, PDF, Markdown and text files generated in the browser, with generated covers, “what's inside” preview images and licence files.

- **PLR Champion:** 6 categories, 12 products, 4 monthly drops (two months ago, last month, this month and next month — scheduled), 2 courses, 4 tool tutorials, 6 resources.
- **PLRforIM:** 6 IM categories, 11 products (lead magnets, welcome-email swipes, affiliate guide, review templates, bonus stacking, SEO, short-form video, a 30-day social calendar, a launch mini-course, an MRR workflow guide and a draft), 4 IM drops, 2 courses, 2 tutorials, 6 resources.

In each, one product is a draft, one is scheduled, one uses Master Resell Rights (not editable), and the access levels are mixed so the preview modes show real differences.

All sample items are marked **Sample**. *Admin → Data → Remove sample content* deletes them (your own products are never touched); *Recreate sample library* brings them back.

## Storage, backup and limits
- Membership data is stored in its **own IndexedDB database** (`plr-champion-membership`), separate from studio projects. Studio clean-up and studio backup restores never affect it, and the studio's *Settings → Erase all data* erases both.
- Download a membership backup from *Admin → Data* regularly; it contains every product, file, image, release, course, resource, download record and lesson progress for the brand.
- Browser storage limits apply (the Data page shows usage and the browser's quota). Very large product files are better kept small until the move to hosted storage.

## How it is built (for later phases)
- `src/lib/membership/` — data model (`types.ts`), its own Dexie database and brand-scoped repositories (`db.ts`), brand registry and theming (`brands.ts`), access rules (`access.ts`), search (`search.ts`), catalogue services (`catalog.ts`), member actions (`member-actions.ts`), the editor bridge, backup, seeding and progress helpers. All pure TypeScript with unit tests.
- `src/features/membership/` — the member shell, pages and admin screens. They read data only through `useMember()`, `useCatalog()` and `useMemberActivity()`, so swapping the storage layer later doesn't touch the UI.
- `src/app/(member)/m/[brand]/…` — routes. Brands are switched on in `LIVE_BRAND_IDS`; any other brand id returns 404.
- **Brands are separate by design.** Every record has a `brandId`; categories, products, releases, courses, resources, downloads, favourites, progress and backups never cross brands (a PLRforIM backup is refused by PLR Champion's restore). Colours, marks, names and the drop name come from `brands.ts`; sample libraries from `sample-libraries.ts`.
- **Accounts are prepared, not live.** `MemberAccount` has per-brand access levels, `bundleIds` and `linkedAccountIds`; `entitlements.ts` resolves them into what each account can open. Today the owner is the only real account; test profiles exist only to preview access.
- Supabase-ready table sketch: see [DATABASE-MIGRATION.md](DATABASE-MIGRATION.md#4-membership-tables).

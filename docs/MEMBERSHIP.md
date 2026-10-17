# PLR Champion membership (Phase 2)

The membership area is the customer-facing side of PLR Champion: a premium member library with downloads, training, resources and the studio tools, plus an owner-only admin for loading products and organising monthly releases.

It lives at **`/m/plr-champion`** (the studio sidebar has a **Memberships** section linking to it). Like every other page it sits behind the owner login — there is no public sign-up, subscription, payment or member account system yet.

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

### Membership Admin (`/m/plr-champion/admin`)
- **Overview** — live / scheduled / draft counts, storage used, products missing a cover, files, category or description, recently edited.
- **Products** — create, edit, duplicate, publish/unpublish, archive, delete. The editor autosaves and covers: title, subtitle, page address, format, description (Markdown with preview), highlights, tags; **files** (drag and drop, up to 200 MB each, type per file, word count measured from editable files); **licence** (type, each right as allowed / not allowed / conditions apply / not stated, conditions text, licence document); **publishing** (status, available-from date, access level, drop, featured); categories; cover and preview images.
- **Categories** — create, edit (name, description, icon, colour), reorder, delete (products are kept).
- **Releases** — create a release for a month, set title/theme/description/cover, tick the products in it (a product belongs to one drop), then **Release now** or **Schedule release** for a date and time. Releasing also publishes the drop's draft products on the same date.
- **Training** — courses and tool tutorials with modules and lessons (article, checklist, download, video link), attachments, level, access level, “Try it” tool.
- **Resources** — files or links (https or an in-app page such as `/profit`), type, access level, order.
- **Data & backup** — storage use, **download a membership backup** (one ZIP), **restore** it (merge or replace), remove or recreate the sample content, erase this brand's membership data.

## Sample content
On the first visit the area creates an original sample library so everything can be tested immediately: 6 categories, 12 products (real DOCX, PDF, Markdown and text files generated in the browser, generated covers and “what's inside” preview images, licence files), 4 monthly drops (two months ago, last month, this month and next month — scheduled), 2 courses, 4 tool tutorials and 6 resources. One product is a draft, one is scheduled, one uses Master Resell Rights (not editable), and the access levels are mixed so the preview modes show real differences.

All sample items are marked **Sample**. *Admin → Data → Remove sample content* deletes them (your own products are never touched); *Recreate sample library* brings them back.

## Storage, backup and limits
- Membership data is stored in its **own IndexedDB database** (`plr-champion-membership`), separate from studio projects. Studio clean-up and studio backup restores never affect it, and the studio's *Settings → Erase all data* erases both.
- Download a membership backup from *Admin → Data* regularly; it contains every product, file, image, release, course, resource, download record and lesson progress for the brand.
- Browser storage limits apply (the Data page shows usage and the browser's quota). Very large product files are better kept small until the move to hosted storage.

## How it is built (for later phases)
- `src/lib/membership/` — data model (`types.ts`), its own Dexie database and brand-scoped repositories (`db.ts`), brand registry and theming (`brands.ts`), access rules (`access.ts`), search (`search.ts`), catalogue services (`catalog.ts`), member actions (`member-actions.ts`), the editor bridge, backup, seeding and progress helpers. All pure TypeScript with unit tests.
- `src/features/membership/` — the member shell, pages and admin screens. They read data only through `useMember()`, `useCatalog()` and `useMemberActivity()`, so swapping the storage layer later doesn't touch the UI.
- `src/app/(member)/m/[brand]/…` — routes. Brands are switched on in `LIVE_BRAND_IDS`; any other brand id returns 404.
- **Brands are separate by design.** Every record has a `brandId`; categories, products, releases, courses, resources, downloads, favourites and progress never cross brands. Colours, names and the drop name come from the brand config. PLRforIM (Phase 3) is already defined there but not yet switched on.
- **Accounts are prepared, not live.** `MemberAccount` has per-brand access levels and `linkedAccountIds` for future bundle purchasers. Today the only account is the owner, created automatically.
- Supabase-ready table sketch: see [DATABASE-MIGRATION.md](DATABASE-MIGRATION.md#4-membership-tables).

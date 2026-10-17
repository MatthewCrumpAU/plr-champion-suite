# Future database migration plan

**Status:** plan only. Nothing here is implemented, and nothing needs doing now. The suite deliberately stores everything in the owner's browser (IndexedDB) — no cloud database. This document explains how to move to a server-side database later (for example to use the suite from several devices without backup/restore) with the least rework.

The constraints of the original brief still apply to any migration: no Supabase, no Firebase, no public registration or multi-user accounts, no BYLDITY integration, and nothing that requires terminal work from the owner.

---

## 1. Where things stand

### One seam for all storage

Every tool reads and writes through the `Repositories` interface in `src/lib/data/repositories.ts`. The only implementation today is `createDexieRepositories()` in `src/lib/data/dexie.ts`, created lazily by `getRepos()` in `src/lib/data/index.ts`. No code outside `src/lib/data/` imports Dexie or touches IndexedDB (checked), so swapping the implementation does not touch the tools.

| Repository | Holds | Notes |
| --- | --- | --- |
| `projects` | `Project` records | soft delete (`deletedAt`), archive (`status`) |
| `assets` | every piece of work — documents, covers, mockups, outlines, scans, research, keyword lists, rights reviews, sales pages, email campaigns, social campaigns, name ideas, profit models, funnels, launch plans | one generic shape: `id, projectId, type, title, status, data (JSON), sourceAssetIds, tags, createdAt, updatedAt, deletedAt` |
| `versions` | per-asset version history (full `data` copies) | reason: manual, auto, import, created, pre-restore, pre-ai, pre-bulk, pre-rebrand, pre-apply |
| `snapshots` | whole-project snapshots (`payload` = project + assets) | |
| `files` | uploaded or generated binaries (source PLR files, images, logos) as `Blob` | `fingerprint` (SHA-256) for duplicate detection |
| `brandKits` | colours, fonts, logo file id | not project-scoped |
| `exports` | export history log | |
| `aiUsage` | token/cost log for AI requests | |
| `settings`, `meta` | key–value | settings include custom launch templates |

Plus `transaction()`, `clearAll()` and `tableCounts()`.

### Versioning

- `DATA_SCHEMA_VERSION` (currently **1**) in `src/lib/data/types.ts`.
- Dexie schema `version(1)` in `dexie.ts`.
- Every asset type has `normalize()` in `src/lib/data/asset-types.ts`, applied on read, so older or partial `data` objects are upgraded in code rather than by rewriting the database.
- Backups (`src/lib/services/backup.ts`) carry `schemaVersion`, are validated with zod and pass through `migrateBackup()` on restore.

### Reactivity

`useLive()` in `src/lib/data/hooks.ts` wraps Dexie's `liveQuery`, so screens update automatically when data changes (including in other tabs). This is the single place that assumes the store is reactive.

---

## 2. Target design

**Database:** PostgreSQL that you control (self-hosted, or a managed provider of your choice that is not on the excluded list). Assets keep their flexible `data` column as `jsonb`, so new tool fields never need a schema change.

**Files:** S3-compatible object storage (or the Postgres `bytea`/large-object route for a small workspace). The database stores metadata and an object key.

**Access:** only through this app's own server routes, behind the existing owner login, signed session and CSRF checks. The browser never receives database credentials. There is still exactly one owner; no user table is added.

### Sketch schema

```sql
create table projects (
  id text primary key,
  name text not null,
  status text not null,            -- active | archived
  data jsonb not null,             -- remaining Project fields
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table assets (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  type text not null,
  title text not null,
  status text not null,
  data jsonb not null,
  source_asset_ids text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);
create index on assets (project_id, type);
create index on assets (updated_at desc);

create table versions  (id text primary key, asset_id text not null, project_id text not null, reason text, label text, data jsonb not null, created_at timestamptz not null);
create table snapshots (id text primary key, project_id text not null, label text, payload jsonb not null, size int, asset_count int, created_at timestamptz not null);
create table files     (id text primary key, project_id text, name text, mime text, size bigint, fingerprint text, kind text, object_key text not null, created_at timestamptz not null);
create table brand_kits(id text primary key, name text, data jsonb not null, updated_at timestamptz not null);
create table exports   (id text primary key, project_id text, asset_id text, data jsonb not null, created_at timestamptz not null);
create table ai_usage  (id text primary key, project_id text, data jsonb not null, created_at timestamptz not null);
create table kv        (scope text not null, key text not null, value jsonb, primary key (scope, key)); -- settings, meta
create table schema_info (version int not null);
```

---

## 3. Migration steps

1. **Contract tests first.** Turn the repository behaviour exercised in `tests/unit/data.test.ts` into a shared contract suite that runs against any `Repositories` implementation. The Dexie implementation must keep passing it.
2. **Server repositories.** Implement `Repositories` on the server against Postgres (e.g. with a lightweight query builder) and run the contract suite against a test database.
3. **API routes.** Add authenticated routes under `/api/data/*` — list/get/put/delete per repository, a batched `transaction` endpoint, and streamed upload/download for files. Reuse the middleware's session and CSRF checks. Use `updatedAt` as an optimistic-concurrency token (`If-Match`) so two open tabs or devices can't silently overwrite each other; on conflict, return the server copy and let the editor offer "keep mine / keep theirs", saving a version first.
4. **HTTP repositories in the browser.** Implement `Repositories` with `fetch` calls to those routes, select it in `getRepos()` from a setting, and keep Dexie as an optional offline cache.
5. **Reactivity.** Replace `liveQuery` inside `useLive()` with fetch + invalidation: repositories emit a local change event after each write (same tab), plus periodic refresh or server-sent events (other devices). Tool code is unchanged because it only calls `useLive()` and the named hooks.
6. **Moving the data.** Reuse the existing backup format — it already contains every table, embedded files and the schema version. Add a server endpoint that accepts a workspace backup, validates it with the existing zod schema, runs `migrateBackup()`, uploads files to object storage and inserts rows in one transaction. The owner's migration is then: *Export Centre → Download full backup → (new setting) Move my workspace to the server → choose the file*. No terminal.
7. **Verify, then switch.** After import, compare `tableCounts()` on both sides and spot-check documents and images. Switch the setting to server storage. Keep the browser copy untouched until the owner removes it from Settings.
8. **Ongoing schema changes.** Bump `DATA_SCHEMA_VERSION`, add an upgrade step to `migrateBackup()` and a matching SQL migration that runs automatically during deployment (a `postbuild` hook or a guarded check at server start), so updates still deploy from GitHub with no manual steps.

### Things to watch

- **File size.** Vercel functions limit request bodies, so large uploads should go directly to object storage with short-lived signed upload URLs issued by an authenticated route.
- **Function duration.** Big imports should be chunked (per project) rather than one long request.
- **Costs.** A server database and object storage add hosting costs and backups to manage. Today's browser storage costs nothing; that trade-off is the main reason it was chosen.
- **Security.** Database credentials live only in server environment variables. Every data route must require the owner session; add the routes to the existing middleware matcher and keep CSRF checks on writes.

---

## 4. Membership tables

The membership area (Phase 2 onward) has its own browser database, `plr-champion-membership`, and its own repository interface (`MembershipRepositories` in `src/lib/membership/db.ts`). Every record carries a `brandId`, so each brand's catalogue and customers stay separate in one set of tables. When the move to a hosted database (Supabase is the intended target) happens, each repository maps to one table and the access rules in `src/lib/membership/access.ts` become row-level-security policies.

```sql
create table member_accounts (
  id text primary key,                 -- later: references auth.users(id)
  email text not null unique,
  display_name text not null,
  role text not null,                  -- owner | member
  brand_access jsonb not null,         -- { "plr-champion": "premium", "plrforim": "member" }
  source text not null,                -- owner | purchase | bundle | manual
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table linked_accounts (account_id text references member_accounts(id), linked_id text references member_accounts(id), primary key (account_id, linked_id));

create table categories (id text primary key, brand_id text not null, name text, slug text, description text, icon text, color text, sort int, created_at timestamptz, updated_at timestamptz, unique (brand_id, slug));
create table products (
  id text primary key, brand_id text not null, slug text not null, title text not null, subtitle text, description text,
  highlights text[], format text, category_ids text[], tags text[], cover_file_id text, gallery_file_ids text[],
  files jsonb not null,                -- attachments: id, file_id, name, kind, size, mime, editable
  licence jsonb not null,              -- type, rights{…}, terms, file_id
  word_count int, page_count int, release_id text, access text not null, status text not null, publish_at timestamptz,
  featured boolean, is_sample boolean, created_at timestamptz, updated_at timestamptz, unique (brand_id, slug)
);
create table releases (id text primary key, brand_id text not null, title text, month text, theme text, description text, product_ids text[], cover_file_id text, status text, publish_at timestamptz, is_sample boolean, created_at timestamptz, updated_at timestamptz);
create table courses (id text primary key, brand_id text not null, kind text, title text, summary text, level text, tool_hint text, cover_file_id text, modules jsonb not null, access text, status text, sort int, is_sample boolean, created_at timestamptz, updated_at timestamptz);
create table resources (id text primary key, brand_id text not null, title text, description text, type text, file_id text, file_name text, file_size bigint, url text, access text, status text, sort int, is_sample boolean, created_at timestamptz, updated_at timestamptz);
create table member_files (id text primary key, brand_id text, name text, mime text, size bigint, object_key text not null, created_at timestamptz);  -- blobs move to Storage buckets per brand

create table downloads (id text primary key, brand_id text not null, member_id text not null references member_accounts(id), product_id text, product_title text, attachment_id text, file_name text, size bigint, kind text, created_at timestamptz);
create table lesson_progress (id text primary key, brand_id text not null, member_id text not null, course_id text, lesson_id text, completed_at timestamptz, checked int[], updated_at timestamptz);
create table favourites (id text primary key, brand_id text not null, member_id text not null, product_id text not null, created_at timestamptz);
```

Policy outline (mirrors `access.ts`): members can select catalogue rows for a brand only when `status` is live (`published`/`scheduled` and `publish_at <= now()`), and can download files only when their `brand_access` tier for that brand is at least the item's `access`. The owner role bypasses both. Downloads, progress and favourites are readable and writable only by their `member_id`. File downloads should go through short-lived signed URLs issued after the same check.

Moving the data uses the membership backup ZIP (`membership.json` + `files/`) exactly as the studio migration uses the workspace backup.

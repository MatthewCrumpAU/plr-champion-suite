# Deploying PLR Champion — no terminal needed

You will put the code in a **private GitHub repository** and connect it to **Vercel**, which builds and hosts it. Everything below happens in a web browser (plus, optionally, the GitHub Desktop app). Allow about 20 minutes the first time.

---

## Before you start

- A **GitHub** account — <https://github.com>
- A **Vercel** account — <https://vercel.com> (sign up with your GitHub account; it makes step 3 simpler)
- Optional: an **Anthropic API key** for AI features — <https://console.anthropic.com>. Everything works without it.

> **Plan note.** The software itself needs no paid service. Vercel's free Hobby plan is limited by Vercel's terms to non-commercial personal use; because you use the suite in your business, Vercel's terms point to its Pro plan. Read Vercel's fair-use guidelines or ask Vercel support if unsure. The app also runs on any host that supports Next.js 15.

---

## 1. Put the code on GitHub

1. Unzip `plr-champion-suite.zip` on your computer.
2. On GitHub, click **+ → New repository**. Name it (for example `plr-champion-suite`), choose **Private**, leave every "Initialize" option unticked, and click **Create repository**.
3. Upload the files — choose one:
   - **GitHub Desktop (easiest for 200+ files).** Install GitHub Desktop, sign in, choose **File → Add local repository**, pick the unzipped folder, accept "create a repository here", click **Publish repository**, keep **Keep this code private** ticked, and pick the repository you created (or let Desktop create it — then skip step 2).
   - **Web upload.** On the new repository page click **uploading an existing file**. GitHub's web uploader accepts up to 100 files per upload, so upload in batches: first everything at the top level of the folder *except* `src` and `tests` (include the `.github` and `docs` folders), commit, then the `src` folder's sub-folders in two or three batches, then `tests`. Folder structure is kept when you drag folders in.

   Do **not** upload a `node_modules` or `.next` folder or any `.env.local` file if one appears.

4. Open the repository's **Actions** tab. A "Checks" run starts automatically after each upload: type check, lint, unit tests, production build and browser tests. A green tick means everything passed.

---

## 2. Create the two required secrets

Open a browser tab you can copy from — you'll paste these into Vercel in step 3.

- **PLR_SESSION_SECRET** — a random string of at least 32 characters. Any password manager can generate one (use 48+ characters, letters and numbers). Or skip it for now: after the first deploy the app's login page shows a ready-made one.
- **Owner password** — pick one of:
  - **PLR_OWNER_PASSWORD_HASH** (recommended). After the first deploy, open your site: because no password is set yet, the login page shows **Finish private setup** with a **Generate hash** box. Type your password, generate, copy the `pbkdf2$…` value. The hash is made inside your browser; the password is never sent anywhere.
  - **PLR_OWNER_PASSWORD** — the password itself, at least 10 characters. Simpler, but the plain password then sits in Vercel's settings.

Use a long, unique password. This password is the only thing protecting your workspace.

---

## 3. Deploy on Vercel

1. In Vercel, click **Add New… → Project**, find your repository under **Import Git Repository** and click **Import**. (If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to that repository.)
2. Vercel detects **Next.js** automatically. Leave the build settings as they are.
3. Open **Environment Variables** and add:

   | Name | Value | Required |
   | --- | --- | --- |
   | `PLR_SESSION_SECRET` | your 32+ character random string | Yes |
   | `PLR_OWNER_PASSWORD_HASH` *or* `PLR_OWNER_PASSWORD` | the hash, or the password | Yes |
   | `ANTHROPIC_API_KEY` | your Anthropic key (`sk-ant-…`) | Only for AI |

   You can leave the owner password out for the very first deploy if you want to use the in-browser hash generator — the site stays locked until it is set.
4. Click **Deploy**. When it finishes, click the preview image or **Visit** to open your site.
5. If you haven't set the password yet: the login page shows the setup screen. Generate the hash, then in Vercel go to **Settings → Environment Variables**, add `PLR_OWNER_PASSWORD_HASH` (and `PLR_SESSION_SECRET` if missing), then **Deployments → ⋯ on the latest → Redeploy**. Environment variable changes only apply after a redeploy.
6. Sign in. The app opens with a clearly labelled **SAMPLE** project so you can explore every tool. Delete it whenever you like (Projects → ⋯ → Move to Trash).

### Optional settings

| Name | What it does | Default |
| --- | --- | --- |
| `PLR_AI_MODEL` | Default AI model: `claude-sonnet-5-5`, `claude-opus-5-5` or `claude-haiku-5-5` | `claude-sonnet-5-5` |
| `PLR_AI_MAX_OUTPUT_TOKENS` | Ceiling on output tokens per AI request (256–64000) — caps the cost of any single request | `8000` |
| `PLR_AI_DISABLED` | `true` switches AI off without removing the key | off |
| `PLR_SESSION_DAYS` | Login length in days (max 30) | `7` |
| `PLR_SESSION_VERSION` | Change the value (e.g. `1` → `2`) and redeploy to sign out every device | `1` |
| `PLR_COOKIE_SECURE` | Leave unset. Cookies are automatically Secure on HTTPS | auto |

Never set `PLR_AI_TEST_PROVIDER` on your deployment. It exists for the automated tests (it makes AI return placeholder text marked `[TEST OUTPUT]`) and is ignored on Vercel production deployments anyway.

---

## 4. Turn on AI (optional)

1. In the Anthropic Console create an API key. Consider setting a monthly spend limit there.
2. In Vercel: **Settings → Environment Variables → Add** `ANTHROPIC_API_KEY`, then **Redeploy**.
3. In the app: **Settings → AI → Test connection**. It sends one tiny request and shows the reply, the model used and the estimated cost.

How it works: AI requests go from your browser to your Vercel server, which calls Anthropic with the key. The key is never sent to the browser. AI only runs when you press an AI button. Each response shows tokens and an *estimated* cost from Anthropic's published prices; Anthropic's invoice is the actual cost. A usage log is under **Settings → AI**.

---

## 5. Recommended hardening

- **Login rate limit at the edge.** The app already slows down and locks out repeated wrong passwords, but on Vercel each server instance counts separately. For deployment-wide protection, open your project's **Firewall** tab in Vercel and, if your plan offers custom rules, add a **rate limit** rule: *Request path* equals `/api/auth/login` and *Method* equals `POST` → for example 10 requests per 60 seconds per IP → **Deny** (or challenge).
- **Deployment Protection** (Vercel → Settings → Deployment Protection) can additionally require Vercel login for *preview* deployments. Your production site is protected by the app's own owner login either way. The protection doesn't rely on a secret URL.
- **Custom domain** (optional): Vercel → Settings → Domains.

---

## 6. Everyday use

- **Your data lives in your browser.** Projects, documents, designs and uploads are stored in the browser's private database (IndexedDB) on the device and browser you use. Another browser or device starts empty. To move work between devices, use **Export Centre → Download full backup** on one, and **Export Centre → Choose backup file** (under *Restore from a backup*) on the other.
- **Back up regularly.** Browser storage can be cleared by "Clear browsing data", by private/incognito windows, or by the browser under storage pressure. Use **Export Centre → Download full backup** (a single `.json` file containing everything, including images) and keep copies somewhere safe. **Settings → Storage → Ask the browser to keep my data** reduces the chance of automatic clearing.
- **Version history and snapshots** protect against mistakes inside the app, but not against the browser deleting its storage. Only backups do that.

## 7. Updating the app later

When you receive an updated version: replace the changed files in your GitHub repository (GitHub Desktop: copy the new files into the folder, then **Commit to main** and **Push origin**; web: upload the files again). Vercel redeploys automatically within a minute or two. Your data stays in your browser and is not affected. Download a workspace backup before major updates.

## 8. Changing the password or signing out everywhere

- **Change password:** in the app open **Settings → Account & security → Change the owner password**, generate a new hash, replace `PLR_OWNER_PASSWORD_HASH` in Vercel, then **Redeploy**.
- **Sign out every device:** change `PLR_SESSION_VERSION` (or `PLR_SESSION_SECRET`) in Vercel and redeploy.

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Login page says **Finish private setup** | One or more required variables is missing or too short. The page lists exactly which. Add them in Vercel and redeploy. |
| "Too many failed attempts" | Wait the time shown. Throttling resets after a successful sign-in. |
| AI buttons say AI is not configured | Add `ANTHROPIC_API_KEY` in Vercel and redeploy. Check **Settings → AI → Test connection**. |
| AI test shows an authentication error | The key is wrong or revoked — create a new one in the Anthropic Console. |
| AI test shows a billing or credit error | Add credit or raise the spend limit in the Anthropic Console. |
| Work is missing | You may be in a different browser, profile or a private window. Restore your latest backup in **Export Centre → Choose backup file**. |
| "Storage is full" message | **Settings → Storage**: prune old automatic versions and remove unused files; delete projects you no longer need from the Trash; download a backup first. |
| A **Checks** run in GitHub shows a red cross | Open it to see which step failed. The site may still deploy; the failure tells you what to fix before relying on that version. |

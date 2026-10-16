# Deploying Trail on Railway

> **Live since 2026-09-22:** project `discerning-connection`, service `Trail`, deployed from GitHub `abdullah-source/Trail` main,
> URL https://trail-hmc.up.railway.app, Postgres attached, free-access mode. Sign-in is Clerk (app `app_3JhjwVxdLj9PVWjj2VS6B3Rdyd4`,
> dev instance keys; the CLI is linked from `trail/`, keys pulled with `clerk env pull --file .env.clerk`). `MAIL_TO_LOG=1` keeps magic links as a log-only fallback. `/install` carries the waitlist and the unpacked zip
> (`web/public/trail-extension.zip`, rebuild with `cd extension && APP_ORIGIN=<APP_URL> npm run package && cp dist/trail-1.0.0.zip ../web/public/trail-extension.zip`, no localhost origins; see §7).
> Signing key id `7f7bf4ea294207a7`; the private PEM is in the Railway variable `TRAIL_SIGNING_KEY` and in `trail-data/railway-signer.pem` on the founder's Mac.

One Railway service runs the FastAPI API and serves the built web app; a Railway Postgres
holds the (text-free) tables. Stripe and Resend are external. The Chrome extension is built
from `extension/` for the app origin and submitted to the Chrome Web Store.

## Demo records

The server signs the six demo essays in `web/public/demo/` at boot and publishes the checkpoints to its transparency log, so `/demo` and `/verify?demo=<id>` pass on the live site. Regenerating demos (`python -m trail.demo_data --out web/public/demo`) changes their events; keep the same ids only if you accept that the old checkpoints will no longer match (the server logs a warning and lists the demo as `signed: false`). Prefer new ids (e.g. `demo-human-1b`) when regenerating after a deploy.

## 0. Before you start

- A domain: `trail.app` (fallback `gettrail.app`).
- Accounts: Railway, Stripe, Resend, Chrome Web Store developer ($5).
- Locally: Python 3.12+, Node 20, pnpm (`corepack enable`).

Generate the two secrets once and keep them in a password manager:

```bash
cd trail
../.venv/bin/trail keygen --out signer.pem        # Ed25519; paste the PEM into TRAIL_SIGNING_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # SESSION_SECRET
```

The public half (`signer.pub.pem`) is served at `/v1/public-key` and embedded in every exported
record; losing the private key means new checkpoints are signed by a new key id (old records stay
verifiable), so back it up.

## 1. Create the project

1. Railway → New Project → **Deploy from GitHub repo** → pick this repository. Root directory: the
   folder that contains `Dockerfile` and `railway.json` (`trail/`). Railway reads `railway.json`:
   Dockerfile build, start command `alembic upgrade head && uvicorn …`, healthcheck `/healthz`.
2. In the same project: **+ New → Database → PostgreSQL**. Railway exposes `DATABASE_URL` on it.

## 2. Variables (service → Variables)

Set exactly these (see `.env.example`):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `TRAIL_SIGNING_KEY` | contents of `signer.pem` (multi-line is fine) |
| `SESSION_SECRET` | the random string from step 0 |
| `APP_URL` | `https://trail.app` (no trailing slash) |
| `RESEND_API_KEY` | from Resend |
| `RESEND_FROM` | `Trail <hello@trail.app>` |
| `FREE_ACCESS` | leave unset. Free mode is on while `STRIPE_SECRET_KEY` is unset: no trial, no paywall, and the site says "free during early access". Set `0` to force pricing on, `1` to keep free mode even with Stripe configured. |
| `STRIPE_SECRET_KEY` | optional, only when you start charging: `sk_live_…` (or `sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | from step 5 |
| `STRIPE_PRICE_SEMESTER` | `price_…` (step 5) |
| `STRIPE_PRICE_MONTHLY` | `price_…` (step 5) |
| `SENTRY_DSN` | optional; leave unset to keep Sentry off |
| `SIGNUP_OPEN` | `1` |

Build-time frontend variables (service → Settings → Build → Docker build args, or put them in
`web/.env.production` and commit): `VITE_EXTENSION_ID` (Chrome Web Store id, step 6) and
`VITE_CHROME_STORE_URL`. Redeploy after changing them; they are baked into the bundle.

## 3. Deploy

Push to the connected branch, or click **Deploy**. The first deploy:

1. builds `web/` with Node 20 and copies `dist/` into the Python image (`trail/server/static/`);
2. runs `alembic upgrade head` against the empty Postgres (creates every table from
   `trail/server/migrations/versions/0001_initial_schema.py`);
3. starts uvicorn on `$PORT`; Railway waits for `GET /healthz` → `{"ok": true, …}`.

Check: `https://<railway-domain>/healthz`, `/` (marketing), `/app` (redirects to `/login`),
`/v1/public-key`, `/v1/schema`. Logs show `GET /healthz 200 3ms` lines only: no bodies, no query
strings.

## 4. Custom domain

Service → Settings → Networking → **Custom Domain** → `trail.app`. Add the CNAME Railway shows
at your registrar (for an apex domain use your DNS provider's ALIAS/ANAME or Railway's provided
A records). Wait for the certificate, then set `APP_URL=https://trail.app` and redeploy so
cookies are `Secure`, magic links use the right host, and the CSRF origin check matches.

## 5. Stripe

1. Products → **Add product** "Trail Semester", recurring, $12.00 every **4 months** → copy
   the price id into `STRIPE_PRICE_SEMESTER`. Add "Trail Monthly", $3.99 every month →
   `STRIPE_PRICE_MONTHLY`.
2. Settings → Billing → **Customer portal**: enable "Cancel subscriptions" (immediately or at period
   end, no retention offers), enable "Update payment method" and invoice history. Save.
3. Developers → Webhooks → **Add endpoint**: `https://trail.app/v1/billing/webhook`, events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Test mode first: repeat 1–3 with test keys, use card `4242 4242 4242 4242`, confirm Settings
   shows the plan, that the portal cancel flips it back after the `deleted` webhook, and that
   "Refund my last payment" refunds in the Stripe dashboard.
5. Renewal reminders (7 days before each charge, DECISIONS §3): add a Railway **cron service**
   from the same image with schedule `0 9 * * *` and command `trail renewal-reminders`, sharing
   the same variables. It emails via Resend and marks each period so nobody is reminded twice.

## 6a. Clerk (hosted sign-in, recommended before Resend)

1. clerk.com → Create application → name "Trail" → enable **Email** (one-time code) and **Google**.
2. API Keys → copy the publishable key (`pk_…`) and secret key (`sk_…`).
3. Railway → Trail service → Variables: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Redeploy.
4. Clerk → Configure → Domains: add the app origin (the Railway URL, later the custom domain) so
   its sign-in box is allowed to run there. The dev instance (`pk_test_`) already allows any origin.
5. Check: `/v1/config` shows `clerkPublishableKey`; `/login` shows Clerk's box; after sign-in
   `/v1/me` answers. `MAIL_TO_LOG` can then be removed (magic links become a fallback only).

## 6. Resend

1. Domains → **Add domain** `trail.app`; add the DKIM/SPF (and optional DMARC) records it
   shows at your registrar; wait for "Verified".
2. API Keys → create a key with sending access → `RESEND_API_KEY`. `RESEND_FROM` must use the
   verified domain. Send yourself a magic link from `/login` to confirm delivery.

## 7. Chrome extension: Web Store submission checklist

Everything below is prepared in the repo. The founder needs a Chrome Web Store developer account
(one-time $5 fee, https://chrome.google.com/webstore/devconsole) to submit.

### 7.1 Build the upload

```bash
cd extension
npm install                      # sharp, for icons and the store images only (not packed)
npm run package                  # = node build.js --store --zip
# -> dist/trail-1.0.0.zip containing ONLY manifest.json, icons/, src/
#    (origin https://trail-hmc.up.railway.app; another one: APP_ORIGIN=https://trail.app npm run package,
#     a new version: node build.js --store --version 1.0.1 --zip)
cp dist/trail-1.0.0.zip ../web/public/trail-extension.zip   # the sideload zip on /install, same build
node build.js --origin https://trail-hmc.up.railway.app --dev  # back to the local dev manifest afterwards
```

`--store` refuses `--dev`, `http://` and localhost origins, writes exactly one origin into
`externally_connectable` and `src/config.js`, and checks the name (≤ 45) and description (≤ 132)
lengths and that every icon exists. The zip step fails if anything other than `manifest.json`,
`icons/` or `src/` ends up inside. Before uploading, check: `unzip -l dist/trail-1.0.0.zip` and
`unzip -p dist/trail-1.0.0.zip manifest.json | grep -c localhost` (must print 0).

The externally_connectable origin is baked into the package: if the app moves to another domain
(e.g. trail.app), rebuild with that origin and upload a new version.

### 7.2 Store listing tab

Copy from `extension/store/listing.md`: name, summary, full description, category **Education**,
language **English (United States)**. Upload `extension/icons/icon128.png` as the store icon,
`extension/store/screenshots/1-replay.png` … `5-popup.png` (1280×800), the small promo tile
`extension/store/promo-small-440x280.png` and the marquee `extension/store/marquee-1400x560.png`.
Homepage URL: https://trail-hmc.up.railway.app. Support URL: mailto:hello@trail.app or the site.

### 7.3 Privacy practices tab

**Single purpose**

> Trail keeps a private, on-device record of how you write in supported editors, so you can replay it, see your patterns, and prove where your work came from.

**Permission justifications** (one per field the dashboard shows)

| Permission | Justification to paste |
| --- | --- |
| `storage` | Stores the student's recording consent, their per-site pause list, the sign-in token for checkpoint signing, and settings in chrome.storage.local. The writing record itself is kept in the extension's IndexedDB on the device. |
| `alarms` | Every 10 minutes an alarm asks the Trail server to sign the latest chain fingerprints (hashes only, never text) of documents that changed, so the student can later prove when their record existed. Runs only after consent and only if signed in. |
| `tabs` | While a document is open in a supported editor, the extension notes which site is in front and for how long (host name and dwell time only, never the URL or title), and when the student returns to the document. This is how the record shows time spent on reference or AI sites. It also opens the welcome page once on install. |
| `scripting` | Used only for the optional "Know where pastes come from" setting: when the student grants the optional all-sites permission, chrome.scripting.registerContentScripts registers our packaged copytrack.js on all sites so a later paste can be attributed to the site it was copied from; it is unregistered when the permission is removed. No code is injected from outside the package. |
| `https://docs.google.com/document/*` | The recorder runs in Google Docs to record typing, deletions and pastes in the document the student is writing, and reads the document's own plain-text export (same origin, the student's session) to keep the record exact. |
| `https://www.notion.so/*`, `https://*.notion.site/*` | The recorder runs in Notion pages the student writes in. |
| `https://word.cloud.microsoft/*`, `https://*.officeapps.live.com/*`, `https://*.sharepoint.com/*` | The recorder runs in Word for the web, which is served from these hosts. |
| `https://*.instructure.com/*` (Canvas), `https://*.moodle.org/*`, `https://*.blackboard.com/*`, `https://*.brightspace.com/*` | The recorder runs in the LMS's own text editor (essay and discussion submissions), and active time on course and assignment pages is counted for the student's homework time log, kept on the device. |
| Optional `https://*/*`, `http://*/*` | Not requested at install. Only if the student turns on "Know where pastes come from" in the popup, Chrome asks for it; then copytrack.js runs on every site and, on copy, keeps the site's host name and a SHA-256 hash of the copied text (never the text) so a later paste into a recorded document can name its source. Turning it off removes the permission and unregisters the script. Without it, pastes from other sites are recorded as "unknown". |
| `externally_connectable` (https://trail-hmc.up.railway.app/*) | Lets the Trail web app, and only that origin (checked again in the service worker), read the local record to show replays and patterns, hand the extension its sign-in token, and give or withdraw recording consent from the welcome page. No other site can talk to the extension. |

**Remote code:** No, I am not using remote code. All JavaScript is in the package; there is no
`eval`, no remotely hosted script, and the only network calls are JSON requests to the Trail
server (`/v1/checkpoint`) and Google Docs' own text export of the open document.

**Data usage** (tick these, honestly):

| Category | Tick | Why |
| --- | --- | --- |
| Personally identifiable information | No | The extension never reads name, email or address. (The web app holds the account email; the extension only stores an opaque token.) |
| Health information | No | |
| Financial and payment information | No | Payments are handled by Stripe on the website, not in the extension. |
| Authentication information | No | The extension stores a Trail-issued API token so it can request signatures; it never collects passwords or credentials from the user or any site. |
| Personal communications | No | It does not read email, chat or messages. |
| Location | No | |
| **Web history** | **Yes** | While a document is open, the host names of the sites in front and the time spent on them (including AI sites), and the LMS course and assignment pages the student worked on. Kept on the device; never sent to our server. |
| **User activity** | **Yes** | Keystrokes, deletions and pastes in supported editors, with timing, and keyboard/mouse activity to count active time on LMS pages. That is the product. Kept on the device. |
| **Website content** | **Yes** | The text of the document being written (snapshots every few minutes, typed and pasted text) in supported editors, and, with the optional permission, a hash of copied text. Kept on the device; only hashes of the record's chain leave it. |

Then tick all three certifications: I do not sell or transfer user data to third parties outside
the approved use cases; I do not use or transfer it for purposes unrelated to the single purpose;
I do not use or transfer it to determine creditworthiness or for lending.

**Privacy policy URL:** https://trail-hmc.up.railway.app/privacy (it carries the single-purpose
statement and the Limited Use sentence).

### 7.4 Upload and submit

1. Developer dashboard → **Add new item** → upload `extension/dist/trail-1.0.0.zip`.
2. **Store listing**: fill from 7.2; save draft.
3. **Privacy practices**: fill from 7.3; save draft.
4. **Distribution**: Public (or Unlisted for a quiet first week), all regions; no in-app purchases
   in the extension (billing is on the website).
5. **Test instructions** (reviewer notes): "Install, click the toolbar button, press Start recording.
   Open any Google Doc and type; open the popup to see the recording state. The record can be
   viewed at https://trail-hmc.up.railway.app/app after signing in with an email code. The optional
   all-sites permission is requested only from the popup toggle 'Know where pastes come from'."
6. **Submit for review**. Review takes days to three weeks; the install page may say "in review"
   only from this point.
7. After approval: copy the item id into `VITE_EXTENSION_ID` and the store URL into
   `VITE_CHROME_STORE_URL` (Railway → Variables), redeploy the web service, and check that the
   welcome page detects the store build (status, getConsent).

For local testing against `vite dev`, run `node build.js --origin https://trail-hmc.up.railway.app --dev`
and load `extension/` unpacked; in the app set `localStorage.trail_extension_id = "<unpacked id>"`.
Harnesses: `PLAYWRIGHT=/path/to/playwright-core/index.mjs node extension/test/<name>-harness.mjs`
for `docs`, `presence`, `ai-tab` and `consent` (nothing recorded before consent; copytrack only with
the optional permission).

## 8. Local run

```bash
cd trail && ../.venv/bin/pip install -e '.[dev]'
cp .env.example .env            # fill APP_URL=http://localhost:8100 and leave the rest empty
../.venv/bin/alembic upgrade head            # SQLite in ./trail-data
(cd web && pnpm install && pnpm build)      # or `pnpm dev` with VITE_MOCK=1 for fixtures
../.venv/bin/trail serve                     # http://localhost:8100 serves API + web/dist
```

Without `RESEND_API_KEY`, the magic link is printed in the server log. Without Stripe keys the
billing buttons are disabled with a clear message.

## 9. Docker locally (optional)

```bash
docker build -t trail . && docker run -p 8080:8080 -e APP_URL=http://localhost:8080 -e SESSION_SECRET=dev trail
curl localhost:8080/healthz
```

## Checks before launch (DECISIONS §8)

- `../.venv/bin/pytest` green (auth, checkpoints, packs, Stripe webhook, privacy sentinel, schema, production guard).
- After any model change: `../.venv/bin/python -m trail.server.gen_schema` regenerates the /privacy table list (the test fails when it is stale) and `alembic revision --autogenerate` writes the migration.
- Boot refuses to start on an https APP_URL without SESSION_SECRET, TRAIL_SIGNING_KEY and RESEND_API_KEY; the log names the missing one.
- `cd web && pnpm test && pnpm build` green.
- `/privacy` lists every table in `/v1/schema` (test `test_privacy_page_lists_every_table`).
- Clean Chrome profile: install → welcome → magic link → connected → paragraph in Docs and Notion
  → replay → export pack → `/verify` and `verify.py` both say valid, under five minutes.

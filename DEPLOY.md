# Deploying Trail on Railway

> **Live since 2026-09-22:** project `discerning-connection`, service `Trail`, deployed from GitHub `abdullah-source/Trail` main,
> URL https://trail-production-36dc.up.railway.app, Postgres attached, free-access mode. Sign-in is Clerk (app `app_3JhjwVxdLj9PVWjj2VS6B3Rdyd4`,
> dev instance keys; the CLI is linked from `trail/`, keys pulled with `clerk env pull --file .env.clerk`). `MAIL_TO_LOG=1` keeps magic links as a log-only fallback. `/install` carries the waitlist and the unpacked zip
> (`web/public/trail-extension.zip`, rebuild with `cd extension && node build.js --origin <APP_URL> --dev && zip -r ../web/public/trail-extension.zip manifest.json icons src`).
> Signing key id `7f7bf4ea294207a7`; the private PEM is in the Railway variable `TRAIL_SIGNING_KEY` and in `trail-data/railway-signer.pem` on the founder's Mac.

One Railway service runs the FastAPI API and serves the built web app; a Railway Postgres
holds the (text-free) tables. Stripe and Resend are external. The Chrome extension is built
from `extension/` for the app origin and submitted to the Chrome Web Store.

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

## 7. Chrome extension

```bash
cd extension
node build.js --origin https://trail.app      # writes manifest.json + src/config.js
zip -r ../trail-extension.zip . -x 'build.js' 'manifest.template.json' 'package.json'
```

Upload the zip in the Chrome Web Store developer dashboard. Listing justification for reviewers:
"Trail records how a document is written (typing rhythm, pastes and their source, drafts)
inside supported editors only, stores it locally in IndexedDB, and never uploads text. The
`<all_urls>` content script only hashes copied text to attribute later pastes. `tabs` records
which sites were open during a writing session (host names and dwell time). `externally_connectable`
lets trail.app read the local record." After publication, copy the extension id into
`VITE_EXTENSION_ID` and redeploy the web service. For local testing against `vite dev`, run
`node build.js --origin https://trail.app --dev` and load `extension/` unpacked; in the app set
`localStorage.trail_extension_id = "<unpacked id>"`.

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

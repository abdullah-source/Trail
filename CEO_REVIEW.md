# CEO review of the delivered build (2026-09-21)

**Verdict: APPROVE WITH FIXES.** Six blockers, none larger than half a day. The architecture matches DECISIONS.md; what is wrong is mostly where the copy promises more than the code does, plus one hole in `/verify` that would let a forged pack pass.

Verified by the founder: pytest 26 passed, vitest 26 passed, tsc clean, build OK (main chunk 394 KB / 130 KB gzip, app pages lazy). Docker not built here. Everything below was checked against the source, not the reports.

## 1. Decisions vs delivery

| § | Status | Evidence |
|---|---|---|
| 1 Name, tagline | Done | `index.html:6`, `Home.tsx:35` |
| 2 Scope, client-side analysis, no event sync | Done | `lib/analysis.ts` (694 lines, parity-tested); events read over `externally_connectable` (`lib/extension.ts:31-51`); server takes heads only (`app.py:385-395`) and full record only on `/v1/pack` (`app.py:397-425`). Extension dashboard removed. Deviation: extension does not import the shared TS analysis (§5); harmless now the popup has no dashboard. |
| 3 Pricing, trial, never-locks, referral, refund | Done | `billing.py:16-19`; paywall gates only views (`AppShell.tsx:123`); checkpoint uses `current_user` not `entitled_user` (`app.py:386`); referral 3→1 semester, cap 3 (`store.py:279-291`); refund (`app.py:454-472`). |
| 4 Magic link, httpOnly cookie, extension token, no .edu | Done | `app.py:248-300`, `store.py:144-170`, `app.py:220` |
| 5 Stack, Railway, env vars, logging rule | Done | `Dockerfile`, `railway.json`, `settings.py`, `app.py:179-185` |
| 6 IA and first-run | Done | `App.tsx:30-50`, `Welcome.tsx`, trial starts on first replay (`Essay.tsx:26-33`) |
| 7 Design brief | Mostly | Fonts are **not** self-hosted (`index.html:31-36`, `tokens.css:9`, `components.tsx:234`). "prove/provable" used (`HowItWorks.tsx:77,150`, `Pricing.tsx:49`). Rail shows "Trial: N days left" on every app page (`AppShell.tsx:81-88`); not a timer, but move it to Settings. |
| 10 Risks | Honoured | Hand-retyped text disclaimed in product (`Home.tsx:132,146`, `Verify.tsx:91`, `Terms.tsx:68`). |

## 2. §8 acceptance criteria

| # | Result | Proof |
|---|---|---|
| 1 pytest incl. auth/checkpoint/pack/webhook/privacy | **PASS** | `tests/test_server.py`, `test_billing.py:36-93`, `test_privacy.py` |
| 2 TS parity, 20 fixtures, all profiles | **PASS** | `analysis.test.ts:41` (≥20; `index.json` has 21), `:50-55` strict equality, `:72-75` six profiles |
| 3 build, docker, /healthz, /, /app | **PARTIAL** | build PASS; docker NOT VERIFIABLE HERE. `Dockerfile:4-28` is sound (pnpm lockfile v9 present, non-root, HEALTHCHECK, `alembic upgrade head` in CMD and `railway.json:8`) |
| 4 Alembic from empty Postgres, §5 env only | NOT VERIFIABLE HERE | Migration = models on SQLite (`test_privacy.py:67-82`); `settings.py:57-78` reads only §5 vars plus `TRAIL_DATA_DIR`/`STATIC_DIR` set in `Dockerfile:16`. `EXTENSION_ORIGINS` (`settings.py:77`) is dead. |
| 5 E2E in 5 minutes | NOT VERIFIABLE HERE | Flow wired end to end (`Welcome.tsx:58-77` polls, opens `?first=1`) |
| 6 Stripe test mode + Resend | NOT VERIFIABLE HERE | Logic covered with `FakeGateway`; real signatures verified (`test_billing.py:18-27`). Renewal email only fires if the founder creates the cron service (`DEPLOY.md:88-90`). |
| 7 Sentinel never stored/logged | **PASS** | `test_privacy.py:38-64`; `app.py:425` logs id/count/ms; uvicorn access log off (`Dockerfile:28`) |
| 8 /privacy lists every table and column, test reads both | **FAIL** | Test checks table *names* only (`test_privacy.py:89-92`). `Privacy.tsx:13-120` invents columns: `users.plan`, `checkpoints.id/doc_id/head_hash/created_at`, `transparency_log.id`, `referrals.completed_at`; omits `users.last_login_at/free_until/referral_credits/renewal_reminded_for`, `checkpoints.body`, `transparency_log.prev/entry_hash`, `magic_links.used_at` (`models.py`). "If it is not here, we do not have it" is false today. |
| 9 Lighthouse, reduced motion | NOT VERIFIABLE HERE | Reduced-motion paths exist (`ReplayHero.tsx:314`, `ReplayPlayer.tsx:39-40,262`). Three external font requests are the LCP risk. |
| 10 CWS review, narrowed hosts, justification | NOT VERIFIABLE HERE | `manifest.template.json:7-19,24`; justification `DEPLOY.md:107-112`. `https://trail.app/*` in `host_permissions` (line 18) is unnecessary for `externally_connectable`; remove it. |
| 11 No body logging, CI grep | **PASS / no CI** | `test_privacy.py:97-110`. The folder is not a git repository; there is no CI. |

## 3. Product judgement

Read as a 19-year-old international student, the copy lands: calm, second person, "your record", no policing words except "prove" three times, and the hand-retyped limit is stated everywhere it matters. The pricing page reads like it was written by someone on my side. No dark patterns in billing: price and renewal date on the Settings buttons (`Settings.tsx:112,121`), one-click portal, refund button, cancelled state says "nothing more will be charged".

Claims the code does not back:
- "No titles" and "a random id, not the title" (`HowItWorks.tsx:110,113`; `Privacy.tsx:34,56`). The extension sends the real document title with every checkpoint (`background.js:215`) and the server stores it (`store.py:368-371`). Doc ids are Google/Notion ids, and for LMS editors the URL path (`recorder.js:21`). Nothing reads `docs.title` back (`data.serverDocs` has no callers), so stop sending it.
- "The app itself self-hosts its fonts" (`Privacy.tsx:197`): false, `index.html:35`.
- "Settings shows every server row about you" (`Privacy.tsx:205`), "receipts are in Settings" (`Pricing.tsx:96`), "Share the replay with a friend" (`Home.tsx:76`): none exist.
- Link lifetime "15 minutes" (`Terms.tsx:22`, `Privacy.tsx:113`) vs 30 in code (`store.py:28`); rows are not "deleted on use".
- "request logs are kept 7 days" (`Privacy.tsx:122`): Railway's retention, not ours; say so or drop it.
- Three placeholder testimonials on the home page (`Home.tsx:186-207`). Ship without the section.

Legal exposure in Terms is modest and deliberate (14 days' notice, 60-day wind-down, verify page up a year, Delaware). Confirm the entity and jurisdiction before launch. The refund promise ("any charge, within 14 days") is wider than the code (see fix 9).

Bundle: 130 KB gzip is under the 200 KB §7 budget with React, router, Framer Motion, marketing pages, Login and the in-browser verifier in one chunk; acceptable. If Lighthouse LCP is tight, lazy-load `Verify` and self-host the fonts first.

## 4. Engineering judgement

**Privacy invariants: solid.** The store never receives events (`store.py`), pack is built in memory and only counts are logged (`app.py:397-425`), access log records method/path/status only (`app.py:179-185`), Sentry is configured with `max_request_body_size="never"` (`app.py:167`), and the sentinel test covers DB, data dir and captured logs. Exception: `ConsoleMailer` logs magic-link tokens (`mail.py:23`); in production this is reached whenever `RESEND_API_KEY` is unset (`app.py:158`).

**Auth: good with two gaps.** Tokens are HMAC-hashed with `SESSION_SECRET` (`store.py:87-88`); cookie is httpOnly, SameSite=Lax, Secure on https (`app.py:220`); magic links are single use, 30 minutes, 5 per 15 minutes per user (`store.py:144-170`); origin check on cookie writes (`app.py:193-199`, localhost allowance is harmless under Lax). Gaps: `/v1/signup` creates an account for any email and returns a bearer token with no verification (`app.py:302-309`); `SESSION_SECRET` silently defaults to `dev-secret-change-me` (`settings.py:67`) and a missing signing key is silently generated into ephemeral `/data` (`app.py:58-67`), so a mis-set Railway variable rotates the key on every deploy.

**Stripe:** `construct_event` on every webhook, 400 on failure, no secret means reject (`billing.py:88-92`, `app.py:474-484`). Upserts are idempotent. Entitlement handles `past_due` with a 3-day grace (`store.py:236`). Refund cancels immediately and marks the row (`app.py:464-470`).

**Referral abuse:** activation is a client call (`app.py:358-363`); with `/v1/signup` it is three curl commands for a free semester, and with plus-addressed Gmail it is three magic links. Cap is 3 credits ($36 max), so economic exposure is small, but fix it.

**Verifier: the real hole.** `/verify` trusts the public key *inside the archive* (`verify.ts:156-157,183,200`) and never compares it with `/v1/public-key` or the transparency log. Anyone can generate a key, fabricate a record, and get "Verified". The copy says otherwise (`HowItWorks.tsx:85,148`).

**Extension:** external messages are origin-checked against the built-in list (`background.js:151-153`, `config.js`); token lives in `chrome.storage.local`; copytrack sends host + hash only (`copytrack.js:12`). Full-text snapshots are kept locally every 3 minutes (`background.js:106`) but not mentioned on the "on your device" list.

**Railway:** deployable as written. Docs are complete (`DEPLOY.md`, `.env.example`). Nothing is under version control, and Railway deploys from GitHub.

## 5. Fixes, in priority order

1. **BLOCKER** `web/src/lib/verify.ts`, `web/src/app/Verify.tsx`: fetch `/v1/public-key` (and `/v1/transparency`) and add a check "signed by Trail's key" that FAILs on any other key; show the key id. Fix `HowItWorks.tsx:148` to match.
2. **BLOCKER** `web/src/marketing/pages/Privacy.tsx`, `tests/test_privacy.py:89-92`: generate `STORED_TABLES` from `schema_description()` (write a JSON at build time) and make the test compare every column, not table names. Fix the 15/30-minute, fonts, "every server row" and "7 days" sentences.
3. **BLOCKER** `extension/src/background.js:215`, `trail/server/app.py:115`, `store.py:368-371`: stop sending and storing titles; drop `docs.title` in a migration. Reword "random id" to "the editor's document id" in `HowItWorks.tsx:110` and `Privacy.tsx:34,56`.
4. **BLOCKER** `trail/server/app.py:302-309`: delete `/v1/signup` and its test; the CLI can use a magic link.
5. **BLOCKER** `trail/server/app.py:153-158`, `settings.py`: when `APP_URL` is https, refuse to start unless `SESSION_SECRET` is non-default, `TRAIL_SIGNING_KEY` is set and `RESEND_API_KEY` is set. Never log a magic link outside dev.
6. **BLOCKER** `web/src/marketing/pages/Home.tsx:186-207`: remove the placeholder testimonials; also drop "Share the replay with a friend" (`:76`).
7. **LATER** `trail/server/app.py:273-286`: move the token out of the GET query string (redirect to `/login/confirm#token=…`, SPA POSTs to a consume endpoint). Protects against link-scanning university mail gateways and edge logs.
8. **LATER** `trail/server/store.py:260-277`, `app.py:248-263`: count an activation only if the user has at least one checkpoint; strip `+tags` when normalising emails; per-IP limit on `/v1/auth/request`; stop returning `created` (enumeration).
9. **LATER** `trail/server/app.py:320`: compute `refundable` from the latest paid charge, not the subscription row's age, so renewals honour "any charge within 14 days".
10. **LATER** Self-host the three fonts (`index.html:31-36`, `tokens.css:9`, `components.tsx:234`); remove `https://trail.app/*` from `host_permissions` (`manifest.template.json:18`); delete `EXTENSION_ORIGINS`; replace "prove/provable"; put price and renewal date on the paywall buttons (`AppShell.tsx:155,164`); move the trial-days line out of the rail; add "text snapshots" to the on-device list; start the trial server-side on first `/v1/pack` too.

## 6. Decision

**APPROVE WITH FIXES.**
The product decided in DECISIONS.md is the product that was built, and the zero-text server is real, tested and documented. The blockers are all about the same thing: the site says "check it yourself" and "tables, not adjectives", and today a forged pack verifies and the tables page is wrong. Fix those six, and the copy is finally as honest as the architecture.

**Next 24 hours:** fix blockers 1–6 (half a day), `git init` and push, deploy to Railway with real secrets, and submit the extension to the Chrome Web Store tonight. Its review is the critical path; nothing else in the launch plan starts until it clears.

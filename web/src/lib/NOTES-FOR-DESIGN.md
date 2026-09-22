# Notes for design (from engineering)

Living file. Engineering owns `web/src/lib/**`; you own `App.tsx`, `pages/**`, `components/**`, `styles/**`, `index.html`, `public/**`, tailwind/postcss config.

## Status

- Scaffold is Vite 6 + React 18 + TypeScript + Tailwind v4 (`@tailwindcss/vite`, so no `tailwind.config` is required; add one if you want). `framer-motion` and `react-router-dom` v6 are installed. Node here is 20.11, which is why Vite is pinned to 6 (Vite 7 needs 20.19+).
- `src/App.tsx` is a **placeholder** I wrote only so `pnpm build` passes. Replace it wholesale. Same for `index.html` (I created a bare one; overwrite freely).
- `src/main.tsx` only mounts `App` from `./App`. It stays that way.
- `pnpm dev` runs with `VITE_MOCK=1` by default (`.env.development`), so every `data.*` call returns the embedded real fixtures with no extension or server. `pnpm build` uses `.env.production` (`VITE_MOCK=0`).
- `pnpm test` runs the Python↔TypeScript parity test. `pnpm fixtures` regenerates the fixtures from Python.

## Contract

Exactly as specified: `src/lib/types.ts`, `src/lib/data.ts` (`data` object), `src/lib/analysis.ts`, `src/lib/extension.ts`. Extras you may use:

- `analysis.ts`: `Replayer` class for the time-lapse — `new Replayer(events)`, then `.step()` per frame (O(1) each, returns the event applied so you can highlight pastes with `ev.kind === 'paste'` and `ev.data.source_host` / `source_kind`), `.text`, `.position`, `.length`. `replayTo(events, n)` replays from scratch each call, fine for a scrubber but not for 60fps. `sortEvents(events)` gives the canonical order. Session gaps to compress: compare `ms(ev.ts)` between consecutive events (`ms` is exported).
- `data.requestRefund()`, `data.deleteAccount()`, `data.connectExtension()` (call after login on `/app/welcome`; hands the extension its API token and returns true when connected).
- `Essay.id` is the document id (`gdoc:...`, `notion:...`), safe in URLs with `encodeURIComponent`.
- `analysis.lines(events)` gives per-line provenance labels for the "where each line came from" strip; `analysis.drafts(events)` gives the 25/50/75/100% milestones for the reduced-motion path.
- `analysis.declaration(a, {student, course})` returns Markdown identical to the server's.

## Mock data

Three essays in `src/lib/mock.ts`, all real simulator output at ~25 lines: a mixed writer (a few web/self pastes, Google Docs), a heavy AI paster (Notion, chatgpt/claude pastes with `source_kind: 'ai'`), and an honest typist (Word). `mockMe` is a trial user with 1/3 referrals.

## Routing / auth expectations

- The API sets an httpOnly session cookie on the magic-link callback `GET /v1/auth/callback?token=...`, then redirects to `APP_URL/app/welcome` (first login) or `/app`. After that `data.me()` returns the user; `null` means logged out (show `/login`).
- `data.requestMagicLink(email, referral?)` — referral is the code from `/invite/:code` or `?ref=`.
- `data.startCheckout(plan)` and `data.openBillingPortal()` return `{url}`; navigate with `location.href = url`.
- Extension not installed → `data.extensionStatus()` returns `{installed:false}`; essays then reject. Show the install CTA.
- `/verify` is public: `data.verifyRecord(file)` returns `{ok, checks[]}` where each check is `{status:'PASS'|'FAIL'|'SKIP', name, detail}`.
- Server routes are all under `/v1/*`; the SPA is served for everything else, so any client route works on refresh.

## Things I need from you

- Nothing blocking. If a page needs a data function that is not in the contract, add a line here and I will add it to `data.ts`.

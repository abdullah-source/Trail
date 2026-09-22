# Longhand

*See how you write.* A student's own writing record. (Python package and CLI keep the name `trail`.) A browser extension records *how* a document
was written, on the student's device: keystroke rhythm, pastes and where they
came from, drafts over time, sources open while writing. Every record is
hash-chained and periodically signed by a service that never sees the text.

What the student gets every day: an essay replay, writing sessions, their own
patterns, and an honest AI-use declaration generated from what actually
happened. What they get if they are ever accused of using AI: a one-click
evidence pack and a verifiable record. The pack shows how the work was
produced. It does not judge content and does not claim to detect text retyped
by hand.

## Free during early access

The server runs in free mode whenever `STRIPE_SECRET_KEY` is unset (or `FREE_ACCESS=1`):
every account has every feature, there is no trial clock and no paywall, and the site,
pricing page and Settings say so. Set Stripe keys (or `FREE_ACCESS=0`) to switch pricing on.

## Layout

| Path | What |
|---|---|
| `trail/core/` | Canonical JSON, SHA-256, Ed25519 checkpoints (reused from BlackBox) |
| `trail/events.py`, `chain.py` | Writing-event schema and per-session hash chain |
| `trail/document.py` | Exact replay with per-character provenance and line labels |
| `trail/analysis.py` | Cadence, pastes, scripted-typing signals, timeline, sessions |
| `trail/pack.py` | Evidence pack (JSON + HTML), drafts, AI-use declaration, patterns |
| `trail/record.py`, `verify.py` | Signed record archive and stdlib-only verifier |
| `trail/server/` | FastAPI API: magic-link auth, checkpoints, transparency log, stateless pack builder, Stripe billing; serves the built web app (SQLAlchemy 2 + Alembic, Postgres on Railway / SQLite locally) |
| `trail/synthetic.py`, `backtest.py` | Simulated writers with ground truth; the 10,000-line validation |
| `extension/` | Chrome extension (MV3): recorder, local IndexedDB store, `externally_connectable` bridge to the web app (`node build.js --origin …`) |
| `web/` | Vite + React + TypeScript app: marketing site, student app (replay, sessions, patterns, declaration, packs, billing) and the browser-side verifier; `src/lib/analysis.ts` is a parity-tested port of the Python analysis |
| `corpus/` | Real public-domain sentences used by the simulator |

## Run

```bash
cd trail && ../.venv/bin/pip install -e '.[dev]'
../.venv/bin/pytest
../.venv/bin/trail backtest --lines 10000      # writes backtest-out/report.md
../.venv/bin/trail demo --profile heavy_paster # writes a sample record and pack
../.venv/bin/alembic upgrade head               # local SQLite schema
(cd web && pnpm install && pnpm test && pnpm build)
../.venv/bin/trail serve                        # API + web app on :8100
```

Build the extension for your origin (`cd extension && node build.js --origin http://localhost:8100 --dev`),
load `extension/` in Chrome via chrome://extensions → Load unpacked, open the popup → "Open my
writing record", sign in with a magic link (printed in the server log locally), then write in
Google Docs, Notion, Word Online or an LMS editor. See `DEPLOY.md` for Railway, Stripe, Resend
and the Chrome Web Store; `DECISIONS.md` is binding.

## Backtest

`trail backtest` simulates honest typists, mixed writers, heavy pasters,
auto-typers, jittered bots and recorder outages over real sentences, with
independent ground truth, and checks reconstruction, chain integrity, line and
character provenance, paste accounting, scripted-typing detection and speed.
See `backtest-out/report.md`.

## Status and limits

- Google Docs renders in a canvas, so positions are not available there:
  Trail records rhythm, pastes and appends in Docs, and line provenance is
  only claimed for editors that expose text (Notion, Word Online, LMS editors).
- The server stores users, plans, signed checkpoint hashes and a transparency
  log (every table is listed at `/v1/schema` and on `/privacy`). It builds
  evidence packs from a record sent for that one request and does not keep it;
  `tests/test_privacy.py` proves a sentinel sentence never reaches the database,
  the data directory or the logs. Sigstore Rekor publishing is not built.
- Firefox/Safari, an instructor portal and per-character provenance in Google
  Docs are out of scope for V1 (DECISIONS §2).

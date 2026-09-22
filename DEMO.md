# Demo Trail on one laptop, today

No accounts, no domain, no Stripe, no Resend. Everything runs on this machine. About ten
minutes the first time, two minutes after that.

## 1. Start the server (terminal 1)

```bash
cd ~/ENTR/trail
export APP_URL=http://127.0.0.1:8100
export SESSION_SECRET=any-long-random-string-at-least-32-chars-xxxxxxxx
../.venv/bin/alembic upgrade head        # local SQLite in ./trail-data (first time only)
../.venv/bin/trail serve                 # API + built web app on http://127.0.0.1:8100
```

Leave it running. Sign-in links are printed in this terminal because there is no email
provider configured; look for lines starting `DEV MAIL`.

If the site looks stale, rebuild the web app first: `cd web && npm run build`.

## 2. Load the extension (once)

The extension is already built for `http://127.0.0.1:8100` (`extension/manifest.json`).
If you rebuild it for another origin: `cd extension && node build.js --origin <origin>`.

1. Chrome → `chrome://extensions` → turn on **Developer mode** (top right).
2. **Load unpacked** → choose the `~/ENTR/trail/extension` folder.
3. Pin "Trail" in the toolbar (puzzle icon → pin).

## 3. Sign in and pair

1. Click the Trail toolbar icon → **Open my writing record**. This opens the app and tells it
   the extension's id.
2. Enter any email (e.g. `demo@uni.example`) → **Send link**.
3. Copy the link from terminal 1 (`DEV MAIL … token=…`) into the address bar. You land on
   the welcome page, signed in, with the plan shown as free.
4. Settings → Extension should read **Connected**.

## 4. Write something

1. Open a Google Doc (or Notion, Word Online, Canvas, Moodle, Blackboard, Brightspace).
2. Type two or three sentences by hand. Paste a sentence from another tab. Delete a few words.
3. Back in the app → **Essays** → the document is there. Open it: the replay plays what you
   just did, the margin shows the paste with its source host, the line labels show typed vs
   pasted, and the AI-use declaration is drafted from the record.

## 5. Show the trust story

- Essay → **Export** → **Evidence pack**. The download is `<title>.trail.tar.gz`.
- Open `http://127.0.0.1:8100/verify` and drop the file on it: every hash, chain and
  signature is checked in the browser against the server's public key and its public log.
- Optional: `../.venv/bin/trail verify <file>` repeats the check offline with stdlib Python.

## What is faked or missing in this demo

- Emails are printed to the terminal instead of sent (no Resend key).
- Nothing costs money: the server runs in free-access mode because no Stripe key is set.
- The extension is unpacked, so its id changes if you move the folder. The popup button
  re-pairs it automatically each time.
- It has been exercised against synthetic editors and this checklist, not yet a long real
  writing session. Do one real essay before showing it to strangers.
- To demo on someone else's laptop, follow `DEPLOY.md` (Railway + Resend, no Stripe needed).

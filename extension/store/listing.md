# Chrome Web Store listing: Trail 1.0.0

Paste these fields into the developer dashboard (Store listing tab). Character limits are checked
below each field.

## Name (from the manifest; 25 of 45 characters)

Trail — see how you write

## Summary / short description (from the manifest; 131 of 132 characters)

A private, on-device record of how you write in Docs, Notion, Word and your LMS. Replay drafts and prove where your work came from.

## Category

Education (Productivity group in the new store categories).

## Language

English (United States).

## Full description

Trail keeps a private record of how you write, on your own computer, so you can replay it, see your patterns, and prove where your work came from.

Got flagged by an AI detector for an essay you wrote yourself? Detectors guess from the finished text. Trail shows how the text was made: the typing, the pauses, the rewrites, and every paste with the site it came from. You can show a teacher that instead of arguing with a score.

WHAT YOU GET
• Replay: watch any essay rebuild itself keystroke by keystroke, with pasted text highlighted and labelled with the site it came from.
• Patterns: how much was typed versus pasted, how long you worked and in how many sittings, how you revise, and whether an AI site was open while you wrote (site name and minutes only).
• An honest AI-use statement, written from what actually happened, that you can edit and attach.
• Proof: every ten minutes the extension has a fingerprint of your record signed and logged publicly. Anyone can check an exported record at the verify page, in their own browser, without trusting us.
• Homework time: how long you actually spent on each class and assignment in your LMS, for you alone.

WHERE IT RECORDS
Only in Google Docs, Notion, Word Online, and Canvas, Moodle, Blackboard and Brightspace pages. Nowhere else.

PRIVATE BY DESIGN
• Nothing records until you press Start recording. You can stop it from the toolbar button at any time.
• Your text and your record stay in your browser. Our server never receives what you write.
• What leaves your computer: a fingerprint (a hash) of each record every ten minutes, and only if you sign in.
• Optional: turn on "Know where pastes come from" and Chrome will ask for access to all sites, so a paste copied from any site can be attributed. Only a fingerprint of what you copy is kept, never the copied text.
• No ads, no analytics on your writing, no selling or sharing of data, no teacher dashboard.

Privacy policy: https://trail-hmc.up.railway.app/privacy
Check a record: https://trail-hmc.up.railway.app/verify

## Single purpose (Privacy practices tab)

Trail keeps a private, on-device record of how you write in supported editors, so you can replay it, see your patterns, and prove where your work came from.

## Images in this folder

| File | Size | Use |
| --- | --- | --- |
| `../icons/icon128.png` | 128×128 | Store icon (96 px artwork, 16 px transparent margin) |
| `screenshots/1-replay.png` | 1280×800 | Live demo: an essay replaying, a paste labelled with its source |
| `screenshots/2-patterns.png` | 1280×800 | Essay page: where each line came from, sessions, pastes, observations |
| `screenshots/3-verify.png` | 1280×800 | Verify page: a demo record checked in the browser, 8 of 8 |
| `screenshots/4-time.png` | 1280×800 | Homework time by class and assignment |
| `screenshots/5-popup.png` | 1280×800 | The popup: first-open consent and recording in a document |
| `promo-small-440x280.png` | 440×280 | Small promo tile |
| `marquee-1400x560.png` | 1400×560 | Marquee promo tile |

Screenshots 1 and 3 were captured from https://trail-hmc.up.railway.app (`/demo?essay=demo-mixed-1`,
`/verify?demo=demo-mixed-1`), 2 and 4 from the app in mock mode (`VITE_MOCK=1`), with the browse tool.
Screenshot 5 and the promo tiles are rendered from `src/*.html`. To rebuild: capture 1-4 again into
`screenshots/`, then `PLAYWRIGHT=/path/to/playwright-core/index.mjs node store/render.mjs` from `extension/`.

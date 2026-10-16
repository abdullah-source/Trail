# Product Hunt launch kit

**Launch only when the extension can be installed from the Chrome Web Store.** Option A: Thursday 29 October 2026 (Day 14). Option B: Wednesday 4 November 2026 (Day 20). If the store has not approved by Day 20, launch after the 21-day window on the first Tuesday to Thursday after approval. Never launch on Election Day (3 November).

Links on the PH page:
- Website: `https://trail-hmc.up.railway.app/?src=producthunt`
- Chrome Web Store listing (once live)
- Demo: `https://trail-hmc.up.railway.app/demo`

---

## 1. Name and tagline

**Name:** Trail

**Tagline (pick one; all under 60 characters):**
1. A signed record of how you wrote your essay (43)
2. Proof of how you wrote it, not an AI detector (45)
3. Show how you wrote it. Signed, replayable, yours. (49)

Recommended: **1**. It says what the thing is.

**Topics:** Education, Chrome Extensions, Privacy, Writing.

---

## 2. Description (under 260 characters)

> Trail records how you write on your own laptop: keystrokes with timing, every paste and its source, sessions over days. It signs the record into a public log every 10 minutes, and anyone can verify it in a browser. It never detects AI and never scores you.

(256 characters.)

---

## 3. Maker's first comment

Post this the minute the launch goes live.

> Hi Product Hunt, I'm Abdullah, a student at Harvey Mudd.
>
> **Why I built this.** Students are being accused of using AI on the strength of a detector percentage, with nothing they can point to in response. A score can't be argued with. A record can be checked.
>
> **What Trail does.** It's a Chrome extension and web app. On your own laptop it records how you write: keystrokes with timing, every paste and the site it came from, writing sessions over days, and time on AI sites, as facts. Every 10 minutes it signs a fingerprint into a public append-only log. You can export your record and anyone can verify it in a browser, with no account. Change one character and verification fails.
>
> From your own record you get a replay of the essay being written, your writing patterns, how long homework actually took, a "Your pace" forecast for the next essay, and a draft AI-use statement you review and edit.
>
> **What it doesn't do.** It never detects AI. It never scores you. The server never sees your text. It's sold only to students, never to schools: the student owns the record and decides who sees it.
>
> **How we tested it.** On 320 real essays and 800 simulated writing processes, 0 of 320 honest writers were flagged as scripted typing, and 160 of 160 scripted essays were.
>
> **What's next.** It's free during early access. There's a waitlist where each friend who joins moves you up 5 places.
>
> The two things I'd like to hear from you: what would make you trust a record like this, and what would stop you from installing it? Critical answers are the most useful.

---

## 4. Gallery shot list

Gallery images at 1270 x 760. Take screenshots from the live site at 1280 px wide; crop and add one caption line in large type above each screenshot. Same caption style on every image.

| # | Image | Caption |
|---|---|---|
| 1 | Replay mid-playback, with the essay half-written | A replay of your essay being written |
| 2 | Paste list with source sites | Every paste, and the site it came from |
| 3 | `/verify` showing a verified record | Anyone can verify it. No account. |
| 4 | `/verify` showing the failed check on a tampered copy | Change one character and it fails |
| 5 | Homework time and "Your pace" | How long it took. How long the next one will. |
| 6 | AI-use declaration draft | An AI-use statement drafted from your own record |
| 7 | Plain text card | It never detects AI. It never scores you. The server never sees your text. |

**Video (optional, first in the gallery):** a 40-second cut of `videos.md` #3 (tamper test) followed by #5 (writing at 4x), with captions and no music with lyrics.

**Thumbnail:** the Trail mark on the paper background from the new design.

---

## 5. Launch-day checklist

**One week before**
- [ ] Store listing live and install tested on a clean Chrome profile
- [ ] Install page shows the one-click store button (`VITE_CHROME_STORE_URL` switched, rebuilt, deployed)
- [ ] `?src=producthunt` writes to the `source` field; tested with one email
- [ ] PH page drafted: name, tagline, description, topics, gallery, links, first comment saved in a note
- [ ] Maker profile complete (photo, bio: "Student at Harvey Mudd, building Trail")
- [ ] 10 friends who have tried Trail agree to look at the page on launch day and leave honest comments if they have something to say (not to upvote on request; Product Hunt prohibits asking for upvotes)
- [ ] X thread and LinkedIn post written (section 6), scheduled for 8:00 am PT
- [ ] `/demo` and `/verify` checked on phone and laptop

**Launch day (times in Pacific)**
- [ ] 12:01 am: launch goes live. Post the first comment immediately.
- [ ] 12:05 am: check every link on the PH page works.
- [ ] 7:00 am: message ambassadors and the 10 friends with the link: "We're on Product Hunt today; if you have feedback, leave it there."
- [ ] 8:00 am: X thread and LinkedIn post go out.
- [ ] All day: reply to every comment within 30 minutes. Answer critical comments directly. If someone calls it a detector, correct it plainly.
- [ ] Noon: post one update in the comments (something learned from the morning's feedback).
- [ ] 6:00 pm: check sign-ups by `source` and log them in `PLAN.md` section 6.
- [ ] 11:30 pm: thank-you comment.

**Day after**
- [ ] Reply to any late comments.
- [ ] Recap post on X and LinkedIn with real numbers.
- [ ] Add any repeated question to the site FAQ or the next video.

Don't: buy upvotes, use upvote groups, ask anyone to "upvote", create accounts, or post in PH-swap communities.

---

## 6. X / LinkedIn launch thread

Post on X as a thread. On LinkedIn, post 1 to 6 as one post with line breaks, and put the link in the first comment.

**1/**
I'm a student at Harvey Mudd. Today I'm launching Trail on Product Hunt.

It keeps a signed record of how you wrote your essay, so if anyone ever questions it, you have something real to show.

**2/**
Right now a student accused of using AI usually faces a detector percentage. There's nothing to point to that would change it.

A score can't be checked. A record can.

**3/**
Trail is a Chrome extension. On your own laptop it records:
- keystrokes with timing
- every paste and the site it came from
- sessions over days
- time on AI sites, as facts

**4/**
Every 10 minutes it signs a fingerprint into a public append-only log.

Export your record and anyone can verify it in a browser, no account. Change one character and verification fails. [attach tamper GIF]

**5/**
What it never does:
- detect AI
- score you
- see your text (the server only gets fingerprints)

It's sold only to students, never to schools.

**6/**
Tested on 320 real essays and 800 simulated writing processes: 0 of 320 honest writers flagged as scripted typing, 160 of 160 scripted essays flagged.

Free during early access. I'd like your honest feedback on Product Hunt: [PH link]

**7/** (X only)
Try the demo without installing anything: trail-hmc.up.railway.app/demo
And the verify page: trail-hmc.up.railway.app/verify

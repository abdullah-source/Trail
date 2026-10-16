# Trail growth plan: 500 confirmed waitlist emails in 21 days

Window: Day 1 = Friday 16 October 2026, Day 21 = Thursday 5 November 2026.
Goal: 500 confirmed waitlist emails, referral share of confirmed sign-ups at or above 30%, and the extension live in the Chrome Web Store.
Source plan: `~/.claude/plans/piped-painting-robin.md` ("Why the waitlist can hit 500", Week 2 D, Week 3).

Other files in this folder:
- `videos.md`: 12 short-video scripts
- `reddit.md`: 6 value-first Reddit posts and the rules to check
- `ambassadors.md`: the campus ambassador program
- `outreach.md`: writing centres, integrity offices, professors, student press, creators
- `producthunt.md`: launch kit
- `professional-waitlists.md`: researchers, lawyers, writers

---

> **Tracking is live.** Tag every link with `?src=<channel>` (lowercase, digits, dashes, up to 24 characters), e.g. `https://trail-hmc.up.railway.app/?src=tiktok` or `/?src=flyer-pomona&ref=YOURCODE`. The first tag a visitor arrives with is kept across pages and stored with their sign-up as `<page>:<channel>`. Read the numbers every evening with:
>
> ```
> cd ~/ENTR/trail && railway run ../.venv/bin/trail waitlist-stats
> ```
>
> It prints totals, confirmed, the share that came through a referral, confirmed sign-ups by source, joins by day, and the top referrers.

## 1. Ground rules for every channel

1. Say what Trail does, not what it judges. Trail records how you write on your own laptop, signs a fingerprint every 10 minutes into a public append-only log, and lets anyone verify an exported record in a browser. It never detects AI and never scores. The server never sees your text.
2. Never write or say "detects AI", "AI detector", "proves you didn't use AI", "beats Turnitin", "guarantees", or anything about grades.
3. The validation numbers are about typing patterns, not AI. Say it this way: "In testing on 320 real essays and 800 simulated writing processes, 0 of 320 honest writers were flagged as scripted typing, and 160 of 160 scripted essays were." Do not shorten it to "100% accurate".
4. Trail is for students. Do not pitch schools, departments or offices. When talking to staff, the ask is feedback, or that they accept a student's verify link, nothing more.
5. Paid people disclose. Ambassadors and any creator who receives money or other compensation say so in every post ("I'm a paid Trail campus ambassador" / #ad).
6. Only confirmed emails count. Nobody is paid or rewarded for unconfirmed sign-ups.
7. Free during early access. Do not promise a future price or a free-forever plan.

## 2. Dependencies (product side, from the approved plan)

| By | What | Why growth needs it |
|---|---|---|
| Day 1 | Referral queue live: "You're #N. Each friend who joins moves you up 5.", share link `/?ref=CODE`, public counter | Without it the referral math below does not happen |
| Day 3 | Source tag on sign-ups: done. `?src=tiktok` is stored as `<page>:tiktok`; read with `trail waitlist-stats` | Fills the by-source table |
| Day 5 | Extension submitted to the Chrome Web Store | Review takes days to three weeks |
| Day 8 | Ambassador referral codes created (one per ambassador) | Ambassador payouts are counted from these |
| Day 14 or 20 | Store approval, `VITE_CHROME_STORE_URL` switched, install page one click | Product Hunt waits for this |

---

## 3. Targets per channel

"Seeded" means a confirmed sign-up that did not come through someone else's referral link. Referrals come on top.

| Channel | Conservative (confirmed) | Stretch (confirmed) | Owner |
|---|---:|---:|---|
| Founder network (friends, group chats, HMC/5C clubs, accelerator) | 60 | 70 | Abdullah |
| Claremont colleges ambassador + tabling + flyers | 70 | 90 | Claremont ambassador + Abdullah |
| Other 4 campuses (ambassadors) | 60 | 90 | 4 ambassadors |
| Short video (TikTok, Reels, Shorts) | 50 | 80 | Abdullah |
| Reddit (profile and comment replies only) | 20 | 25 | Abdullah |
| Product Hunt + X + LinkedIn | 30 | 35 | Abdullah |
| Writing centres, professors, student newspaper | 20 | 20 | Abdullah |
| Creators (study-tok, international-student) | 20 | 20 | Abdullah |
| Professional waitlists (researchers, lawyers, writers) | 20 | 20 | Abdullah |
| **Seeded total** | **350** | **450** | |
| Referrals (friends via `/?ref=CODE`) | 150 | 330 | everyone |
| **Total confirmed** | **500** | **780** | |
| Referral share | 30% | 42% | |

Sign-ups needed: if about 80% of sign-ups confirm their email, 500 confirmed means about 625 sign-ups. Track the confirmation rate daily (section 6).

---

## 4. Referral-coefficient math

Definitions:
- S = seeded confirmed sign-ups (not referred).
- k = confirmed friends brought in per confirmed member (the viral coefficient).
- t = the share of members who join early enough to refer before Day 21. Most referrals happen within 48 hours of joining, so members who join in the last two days refer little. Use t = 0.85.

Each generation brings in k x t times the previous one:

```
Total = S x (1 + kt + (kt)^2 + (kt)^3 + ...)  ~=  S / (1 - kt)
```

In three weeks you get about two generations, so in practice:

```
Total ~= S x (1 + kt + (kt)^2)
```

| Scenario | S | k | kt | Gen 0 | Gen 1 | Gen 2 | Total (2 gens) | Total (limit) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Miss | 300 | 0.25 | 0.21 | 300 | 64 | 14 | 378 | 381 |
| Conservative | 350 | 0.40 | 0.34 | 350 | 119 | 40 | 509 | 530 |
| Stretch | 450 | 0.50 | 0.43 | 450 | 191 | 81 | 722 | 783 |

What this says:
- 500 needs either S = 350 with k = 0.4, or more seeding to make up for a weaker k. Each 0.1 of k is worth about 50 sign-ups at S = 350. Each extra 50 seeded is worth about 70 at k = 0.4.
- k = 0.4 means 4 in 10 members bring one confirmed friend. The queue rewards this directly: each confirmed friend moves you up 5 places.
- How to raise k: show rank right after sign-up and in the confirmation email; give a ready-made share text for iMessage, WhatsApp and Instagram stories; send one rank email on Day 10 and one on Day 18 ("You're #N. 3 friends puts you at #N-15."); if the top-50 reward ships as planned (store build first and a "Founding writer" badge on the verify page), say so in every share prompt.
- Measured k each day = (confirmed sign-ups that came with a ref code) / (confirmed sign-ups that existed 2 days earlier). Write it in the metrics table.

---

## 5. Day-by-day calendar

Cross-post every video to TikTok, Instagram Reels and YouTube Shorts on the same day. Video numbers refer to `videos.md`. Reddit posts refer to `reddit.md`. Emails and DMs refer to `outreach.md`.

Calendar notes: mid-October is midterm season; Early Decision and Early Action deadlines fall on 1 November (Day 17); Halloween is Saturday 31 October (Day 16); US Election Day is Tuesday 3 November (Day 19), so no launch or big post that day.

### Week 1: seed and open the queue (target: 120 confirmed)

| Day | Date | Post | Where | Message / outreach | Ambassadors | Other |
|---|---|---|---|---|---|---|
| 1 | Fri 16 Oct | Personal post: "I built this, here's why, join the queue" | Instagram story, LinkedIn, accelerator Slack | Personal texts to 40 close contacts (one by one, not a group blast) | Write recruiting post; list 3 candidates per campus | Test the queue end to end with two emails; start the metrics table |
| 2 | Sat 17 Oct | none | | Personal texts to the next 40 contacts | Ask 5C friends for names of people who run clubs or are well known online | Film videos 3, 5, 7, 8 (screen recordings first) |
| 3 | Sun 18 Oct | Video 5 (writing at 4x) | TikTok, Reels, Shorts | Post in 3 HMC/5C group chats you are already in | | Reddit post 1, r/college, Sunday evening |
| 4 | Mon 19 Oct | Video 3 (tamper) | all three | Writing-centre emails to the 5 Claremont centres (outreach.md section 1) | Send recruiting DMs to 15 candidates across 5 campuses | |
| 5 | Tue 20 Oct | Video 2 (Google Docs history) | all three | Creator DMs, batch 1 (10) | Reply to candidates; book 15-minute calls | Store submission (dependency); Reddit post 6, r/InternationalStudents |
| 6 | Wed 21 Oct | Video 6 (AI-use statement) | all three | Student newspaper pitch to The Student Life; 3 professor emails | Calls with candidates | |
| 7 | Thu 22 Oct | Video 8 (essay pace) | all three | Academic-integrity office emails (outreach.md section 2) | Pick 5 ambassadors; send agreement and kit | Reddit post 3, r/GradSchool; week 1 review (section 7) |

### Week 2: content engine and ambassadors start (target: 300 confirmed by Day 14)

| Day | Date | Post | Where | Message / outreach | Ambassadors | Other |
|---|---|---|---|---|---|---|
| 8 | Fri 23 Oct | Video 7 (screen time for homework) | all three | Follow up the writing centres that did not reply | 30-minute onboarding call (all 5); ref codes issued; flyers printed | Claremont flyers go up (dorms, Hoch-Shanahan, Honnold-Mudd, Frary, Collins, Malott, McConnell) |
| 9 | Sat 24 Oct | Video 11 (paste sources) | all three | Professional-waitlist interview outreach begins (professional-waitlists.md) | Ambassadors post their personal story, with disclosure | |
| 10 | Sun 25 Oct | Video 8 recut for college apps ("how long will my Common App essay take") | all three | Rank email to everyone on the list | | Reddit post 2, r/ApplyingToCollege (one week before ED/EA deadlines) |
| 11 | Mon 26 Oct | Video 9 (professor reaction), if filmed; otherwise video 12 | all three | Creator DMs, batch 2 (10) | Claremont tabling #1, lunch, two hours (ambassadors.md tabling script) | |
| 12 | Tue 27 Oct | Video 1 (flagged, here's my replay), only with a real student; otherwise video 10 | all three | Professor follow-ups | Other 4 campuses: flyers up, first group-chat posts | Reddit post 5, r/EdTech |
| 13 | Wed 28 Oct | Video 4 (the honest Cluely) | all three | Line up 10 friends to try and comment on the PH page on launch day (ask for honest feedback, not upvotes) | Weekly check-in #1 (ambassadors.md) | Product Hunt page drafted and scheduled if the store has approved |
| 14 | Thu 29 Oct | **Product Hunt day (option A)** if the store build is live; otherwise video 10 (duet/stitch prompt) | Product Hunt, X thread, LinkedIn | All-day replies on PH, X and LinkedIn | Ambassadors share the PH link in their group chats (not to ask for votes) | Week 2 review (section 7) |

### Week 3: campus push and store live (target: 500 confirmed by Day 21)

| Day | Date | Post | Where | Message / outreach | Ambassadors | Other |
|---|---|---|---|---|---|---|
| 15 | Fri 30 Oct | PH recap post ("what 1 day on Product Hunt taught me"), or video 10 | X, LinkedIn, all three video apps | Thank-you replies to everyone who commented | Claremont tabling #2 (morning, short) | |
| 16 | Sat 31 Oct | Video 12 (what Trail never does), light day | all three | | | Halloween: no tabling |
| 17 | Sun 1 Nov | Video 6 recut ("I submitted my ED essay with its own record") only if true for the person filming | all three | Reply to A2C comments | | ED/EA deadline day |
| 18 | Mon 2 Nov | Store-live video: "it's in the Chrome Web Store now", if approved | all three | Rank email #2: "Last 3 days. Top 50 get the store build first." | Final push: each ambassador posts once and tables once this week | Reddit post 4, r/Professors, only with mod approval |
| 19 | Tue 3 Nov | none (Election Day) | | Professional-waitlist interviews (calls) | Tabling only if the campus is quiet that day | |
| 20 | Wed 4 Nov | **Product Hunt day (option B)** if approval came after Day 14; otherwise the best video so far, re-cut | Product Hunt, X, LinkedIn | All-day replies | Ambassadors share the PH link | |
| 21 | Thu 5 Nov | Thank-you post with the real number (whatever it is) | Instagram, LinkedIn, X | Email the top 50 about store access | Count confirmed referrals per code; pay $50 and $25 bonuses | Retro: which source worked, by the numbers in section 6 |

Product Hunt rule: launch only when someone can install the extension from the Chrome Web Store. If the store has not approved by Day 20, do not launch on Product Hunt in this window; move it to the first Tuesday-Thursday after approval and put that day's effort into tabling and video instead.

### Ambassador timeline (summary)

| Days | Step |
|---|---|
| 1-3 | List candidates (3 per campus) |
| 4-6 | Recruiting DMs, 15-minute calls |
| 7 | Choose 5; send agreement, kit, flyer file |
| 8 | Onboarding call; ref codes issued; Claremont flyers up |
| 9-12 | Personal posts (with disclosure); flyers at the other 4 campuses; first tabling |
| 13 | Check-in #1 |
| 14-20 | Tabling, group chats, PH share; check-in #2 on Day 20 |
| 21 | Count confirmed referrals per code; pay |

---

## 6. Daily metrics (fill in each evening)

Confirmation rate = new confirmed / new sign-ups. Referral share = new referred confirmed / new confirmed. Measured k = referred confirmed today / cumulative confirmed two days earlier.

### 6a. Totals

| Day | Date | New sign-ups | New confirmed | Confirm rate | Cumulative confirmed | Conservative target | Stretch target | Referred confirmed (new) | Referral share | Measured k |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 16 Oct | | | | | 15 | 20 | | | |
| 2 | 17 Oct | | | | | 25 | 35 | | | |
| 3 | 18 Oct | | | | | 40 | 55 | | | |
| 4 | 19 Oct | | | | | 55 | 75 | | | |
| 5 | 20 Oct | | | | | 75 | 100 | | | |
| 6 | 21 Oct | | | | | 95 | 125 | | | |
| 7 | 22 Oct | | | | | 120 | 155 | | | |
| 8 | 23 Oct | | | | | 140 | 185 | | | |
| 9 | 24 Oct | | | | | 155 | 210 | | | |
| 10 | 25 Oct | | | | | 175 | 240 | | | |
| 11 | 26 Oct | | | | | 200 | 275 | | | |
| 12 | 27 Oct | | | | | 225 | 310 | | | |
| 13 | 28 Oct | | | | | 245 | 340 | | | |
| 14 | 29 Oct | | | | | 300 | 420 | | | |
| 15 | 30 Oct | | | | | 330 | 465 | | | |
| 16 | 31 Oct | | | | | 345 | 490 | | | |
| 17 | 1 Nov | | | | | 365 | 525 | | | |
| 18 | 2 Nov | | | | | 395 | 580 | | | |
| 19 | 3 Nov | | | | | 410 | 610 | | | |
| 20 | 4 Nov | | | | | 455 | 690 | | | |
| 21 | 5 Nov | | | | | 500 | 780 | | | |

If Product Hunt moves to Day 20, move the Day 14 jump (about 40 conservative) to Day 20.

### 6b. New confirmed by source

| Day | Founder network | Claremont | Other campuses | Video | Reddit | PH / X / LinkedIn | Outreach / press | Creators | Professional | Referral | Unknown | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | |
| 6 | | | | | | | | | | | | |
| 7 | | | | | | | | | | | | |
| 8 | | | | | | | | | | | | |
| 9 | | | | | | | | | | | | |
| 10 | | | | | | | | | | | | |
| 11 | | | | | | | | | | | | |
| 12 | | | | | | | | | | | | |
| 13 | | | | | | | | | | | | |
| 14 | | | | | | | | | | | | |
| 15 | | | | | | | | | | | | |
| 16 | | | | | | | | | | | | |
| 17 | | | | | | | | | | | | |
| 18 | | | | | | | | | | | | |
| 19 | | | | | | | | | | | | |
| 20 | | | | | | | | | | | | |
| 21 | | | | | | | | | | | | |
| **Total** | | | | | | | | | | | | |
| Conservative target | 60 | 70 | 60 | 50 | 20 | 30 | 20 | 20 | 20 | 150 | 0 | 500 |

Ambassador referrals count under their campus column, not under "Referral". "Referral" is member-to-member links.

### 6c. Ambassador tally (update at each check-in)

| Ambassador | Campus | Ref code | Confirmed Day 13 | Confirmed Day 20 | Confirmed Day 21 | $50 paid | $25 bonus (100+) |
|---|---|---|---:|---:|---:|---|---|
| | Claremont colleges | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |

---

## 7. Weekly reviews and what to change

Day 7 (target 120):
- Below 90: the seed is too small. Add 40 more personal texts, ask 5 friends to post the link in their own group chats, and post two videos a day for three days.
- Confirmation rate below 75%: the email is probably landing in spam or promotions. Check it from a Gmail, an Outlook and a school address, shorten the subject, send from a real-looking sender.
- Referral share below 20%: the share prompt is not working. Make the rank and the "+5 places" bigger on the confirmation page, put the share text in the confirmation email, and send the rank email early.

Day 14 (target 300):
- Find the one video with the most profile visits per view and make two more in that format.
- Drop any channel with zero confirmed sign-ups in 7 days and move its time to tabling.
- If an ambassador has fewer than 10 confirmed, do a call; offer to table with them once.

Day 21: count, pay, and write a short retro with section 6 filled in: which three sources produced the most confirmed sign-ups per hour of founder time.

---

## 8. Budget

| Item | Cost |
|---|---:|
| Ambassadors: 5 x $50 base | $250 |
| Ambassador bonuses: up to 5 x $25 | up to $125 |
| Flyers: about 300 prints (black and white is fine) | about $30 |
| Tabling: snacks or stickers (check campus rules on food) | about $40 |
| Chrome Web Store developer account (one-time) | $5 |
| **Total** | **about $450** |

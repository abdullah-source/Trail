# Trail design system

Owned by design. Source of truth for `web/src/design/*`, `web/src/marketing/*`, `web/public/*`.

## 1. Concept: the manuscript

A Trail page is a page of writing coming into being. Everything on the site follows from three facts about a manuscript:

- **Typed text is just ink.** We do not colour a student's own words. Only what arrived from elsewhere gets marked: pasted text sits under a **highlighter** wash with a small mono chip naming its source.
- **The margin is where the record lives.** Every section hangs off a thin red **notebook margin rule** on the left, and the margin carries a timecode (`00:12`) and a one-word label, like a replay scrubber running down the page. Nothing is centered. This is the one aesthetic risk: a page-level margin instead of cards with accent rails.
- **Only the replay moves.** The hero is a real essay growing. The rest of the page arrives once and then stays still.

Banned (DECISIONS §7): gradient blobs, glassmorphism, purple-on-black, stock students, emoji headers, the words detect/prove/cheating/flag.

## 2. Palette

Light is paper under a desk lamp; dark is the same desk at 1am. All text pairs meet WCAG 2.2 AA (4.5:1) on both `paper` and `sheet`; `ink-faint` (3.8:1) is for large or decorative text only.

| token | light | dark | role |
|---|---|---|---|
| `--paper` | `#F2EEE4` | `#121110` | page |
| `--sheet` | `#FBF9F3` | `#1A1917` | cards, the essay sheet |
| `--well` | `#E9E4D7` | `#22201D` | hover fills |
| `--ink` | `#18181B` | `#ECE7DC` | text, typed words |
| `--ink-soft` | `#57534B` | `#ABA497` | secondary text (6.6:1 / 7.6:1) |
| `--ink-faint` | `#7C776D` | `#7D776C` | large/decorative only |
| `--rule` | `#D8D2C4` | `#2C2925` | hairlines |
| `--rule-strong` | `#B4AC9C` | `#47433C` | borders on controls |
| `--margin` | `#B8422F` | `#E0685A` | notebook margin rule, gap ticks, strike-through; never body text |
| `--typed` | `#1C6B4C` | `#63C08F` | typed share in strips and stats |
| `--paste` | `#A84E0C` | `#F0A050` | paste chips and strips |
| `--paste-wash` | `rgba(255,176,44,.32)` | `rgba(240,160,80,.30)` | highlighter over pasted text |
| `--mixed` / `--unobserved` | `#7F6410` / `#6E6A62` | `#D9B54A` / `#8C877B` | provenance strip |
| `--accent` | `#1E3EA3` | `#9FB5FF` | the pen: links, focus, caret, progress |
| `--accent-ink` | `#FBF9F3` | `#0F1424` | text on accent |

Dark applies under `@media (prefers-color-scheme: dark)` (unless `html[data-theme="light"]`) and under `html[data-theme="dark"]`. Tailwind utilities (`bg-paper`, `text-ink-soft`, `border-margin/40`, `bg-paste`) resolve to these variables through `@theme inline`, so no `dark:` variants are needed.

## 3. Type

- **Newsreader** (serif, variable opsz 6–72, weights 400 and 500, italic 400): headings at large optical size, essay text at `opsz 16`. It is a text face built for screens, narrower and quieter than the display serifs every AI site uses.
- **IBM Plex Sans** 400 / 600: all UI copy, buttons, body on marketing pages.
- **IBM Plex Mono** 400: timecodes, marginals (`.marginal`: 11px caps, 0.08em tracking), chips, tables.

Link tag for `index.html` (engineering adds it; `MarketingLayout` injects it at runtime if missing, and `tokens.css` carries the `@import`, which only survives when it precedes Tailwind's rules):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono&display=swap" />
```

Scale (rem): 0.75 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 3 / 4.25. Body 16px, line-height 1.55; essay 17–18px, line-height 1.6; h1 48–68px at line-height 1.08. Numbers are always `tabular-nums`.

## 4. Spacing and layout

4px base (`--spacing: .25rem`). Inside components use 2/3/4/6 (8–24px). Sections use 14 (56px) vertical on desktop, 6–8 on phones. Page container `max-w-6xl`, gutters 16px on phones, 24px from `sm`. The section grid is `[6.5rem_1fr]` at `md`, `[8rem_1fr]` at `lg`; the margin cell has the red rule (`border-margin/40`) and a sticky timecode. Radii: 3 / 6 / 10px. Cards are `sheet` with a hairline border, no shadow except the essay sheet (`shadow-sheet`).

## 5. Motion

- **The replay is the only thing that moves.** Characters land on a human rhythm (38–100ms, longer after punctuation), typos are backspaced, a rewrite is struck through in margin red and then cut, pastes fade in under highlighter with their chip sliding in, gaps show as "38 min later" and a red tick on the scrubber. It loops after a 2.6s hold, pauses on mouse hover and while the scrubber has focus, and ignores time spent in a hidden tab.
- Everything else gets at most one arrival: `FadeUp` (12px rise, 480ms, ease `[.2,.7,.2,1]`), or `Stagger` at 70ms between children, triggered once in view. No hover lifts, no parallax, no looping decoration.
- **Reduced motion:** `useReducedMotion` from framer-motion drives every primitive. `FadeUp`/`Stagger` render plain divs. `ReplayHero` renders three static drafts (30%, 64%, final) with a Draft 1 / Draft 2 / Final step control and a 200ms opacity crossfade. `tokens.css` also zeroes CSS animations and transitions globally under the media query. The caret does not blink.

## 6. Components (`src/design`)

`tokens.css` (variables, base type, `.marginal .display .essay .link .ruled .caret .strike .prov-paste .prov-paste-edited .prov-unobserved .range .tabular`) · `motion.tsx`: `FadeUp`, `Stagger`, `StaggerItem`, `Motion`, `usePrefersReducedMotion`, `EASE` · `components.tsx`: `Button`, `ButtonLink`, `Eyebrow`, `Mark`, `Wordmark`, `ThemeToggle`, `Nav`, `Footer`, `MarketingLayout`, `Section`, `Card`, `Stat`, `Badge`, `PriceCard`, `Heading`, `Prose`, `Row`, `Disclosure`, `useTitle`, `useFonts`, `cx`, `CHROME_STORE_URL`, `FONTS_HREF` · `ReplayHero.tsx`: `ReplayHero`, `SCRIPT`, `ReplayOp` · `Provenance.tsx`: `Provenance`, `ProvenanceStrip`, `PasteList`, `Swatch`.

Focus: 2px `--accent` outline, 3px offset, on every interactive element; the scrubber thumb gets a 4px accent halo. All text is real text; the only images are `public/favicon.svg` and `public/wordmark.svg`.

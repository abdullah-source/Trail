# DESIGN.md — Longhand

Design source of truth for the marketing site and the student app. DECISIONS.md §7 is binding; this document makes it concrete.

## 1. Audience and the single job

College students, 18–25, half international, writing on a laptop between 10pm and 2am, wary of anything that smells like surveillance. They screenshot things that feel like *theirs*.

The product has one job: **show a student their own writing happening.** Everything else (sessions, patterns, declaration, evidence pack) is downstream of the replay. So the replay is the hero on `/`, the centre of `/app/essays/:id`, and the only thing on any page that moves.

Tone rules from DECISIONS §7 apply to copy and to visuals: never "detect", "prove", "flag". Say "your record", "your replay", "your patterns". The colour for pasted text is a warm marker, not a red alarm.

## 2. Aesthetic direction: the manuscript, not the dashboard

The name is *Longhand*: writing in your own hand, over time. The interface should feel like a well-made notebook that happens to be able to rewind.

Specific moves:

- **Ruled paper as structure.** Horizontal hairline rules (1px, `--rule`) carry the layout: section dividers, table rows, the replay's line strip. A faint left margin line on the essay page (the red margin of a composition book, done in `--ink-faint`, not red).
- **Ink, not pixels.** Essay text is set in a serif with real italics. Typed text is ink-dark. Pasted text is highlighted the way a student highlights a photocopy: a translucent marker band behind the words, in `--paste`, with a small source chip (`chatgpt.com`) in the margin.
- **Marginalia.** Labels, timestamps and counts live in the margin in small mono caps, like pencil notes beside a draft. On wide screens the essay page is a two-column manuscript: text on the right, marginalia on the left.
- **The time-lapse is a draft becoming an essay.** Words appear at typing rhythm; deletions strike out then vanish; session gaps compress and are shown as a dotted rule with "2h 14m later" in the margin. A blinking block cursor at the growing edge is the only decorative motion.
- **Asymmetry.** Headlines left-aligned on a 12-column grid; marketing sections alternate a 5/7 split. Nothing is centred except the login card and the 404.
- **Deliberately not:** cream + serif + terracotta AI default, purple gradients, glass, blobs, 3D anything, Inter or Space Grotesk, emoji, stock photos.

## 3. Palette

Two designed themes. Light is warm paper; dark is a desk lamp at midnight (near-black with warm ink, not blue-black).

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#F7F4EC` | `#141210` | page background |
| `--sheet` | `#FFFDF8` | `#1C1915` | cards, the essay sheet |
| `--ink` | `#1B1917` | `#EDE7DA` | body text |
| `--ink-soft` | `#5E5850` | `#A39C8F` | secondary text, marginalia |
| `--rule` | `#DAD3C4` | `#2E2924` | hairlines, borders |
| `--typed` | `#1F6B4A` | `#5DBA8B` | typed provenance (green, muted) |
| `--paste` | `#C2611E` | `#E5924E` | pasted provenance (marker orange) |
| `--mixed` | `#9C7A17` | `#D1B04D` | mixed lines |
| `--unobserved` | `#8A8578` | `#6E685D` | unobserved chars |
| `--accent` | `#2B4C7E` | `#8FB0E6` | links, focus ring, primary button (fountain-pen blue) |

Contrast checked at AA for all text tokens on both `--paper` and `--sheet`. Paste highlight is `--paste` at 18% alpha behind ink text (light) and 28% (dark), so the text stays `--ink` and stays readable.

## 4. Type

- **Display: Fraunces** (variable, optical size, `wght` 400 + 600, `SOFT` 30). Characterful, a little wonky, unmistakably not a system font. Headlines, essay text in the replay, numbers on the pricing page.
- **Body/UI: Source Sans 3** (400, 600). Neutral, humanist, reads well at 14px in tables.
- **Mono: JetBrains Mono** (400). Timestamps, hashes, counts, chips, the marginalia. `font-variant-numeric: tabular-nums` everywhere data appears.

Loaded from Google Fonts via `<link>` in `index.html` with `display=swap`; two weights per face maximum.

Scale (rem, 16px base): `xs 0.75` · `sm 0.875` · `base 1` · `lg 1.125` · `xl 1.375` · `2xl 1.75` · `3xl 2.375` · `4xl 3.25` · `5xl 4.5`. Display faces use tighter leading (1.05–1.15); body 1.55. Headings get `text-wrap: balance`.

## 5. Layout

- Container `max-w-6xl` (72rem), 12-column grid at ≥1024px, gutters `px-5` on mobile, `px-8` at md.
- Marketing sections are 5/7 or 7/5 splits, never stacked-and-centred. Section spacing `py-24` desktop, `py-16` mobile.
- App shell: 240px left rail (essay list nav, patterns, invite, settings) on ≥1024px; top bar on smaller screens with a sheet menu. Content column max 56rem for reading.
- Essay page: `grid-cols-[10rem_1fr]` on ≥1024px (marginalia | sheet); single column on mobile with marginalia inline above each block.
- 390px: every page single column, hero replay full-bleed with 16px gutter, tables become stacked definition lists.

## 6. Motion

Principles:

1. **The replay is the only thing that moves.** It is a custom rAF renderer: one DOM node per line, text set by string diff, cursor as a CSS animation. Speeds 1×/4×/16×; session gaps compressed to a 600ms pause with a margin note.
2. **Page load is a page turn, not a fireworks show.** One `motion.div` stagger on the hero: headline, then subhead, then the replay sheet, 80ms apart, 400ms, ease-out, y 8px. Nothing else animates on load.
3. **Hover is ink bleeding, not scaling.** Links underline with a 1px offset rule that thickens; buttons darken 6%; cards shift border from `--rule` to `--ink-soft`. Duration 150ms. No transforms on hover.
4. **Reduced motion is a designed state.** `useReducedMotion()` → the replay shows four draft milestones (25/50/75/100%) as a stepper with prev/next buttons and the same provenance colouring; no cursor blink; stagger disabled. Everything is still readable and still interesting.
5. **Charts do not animate.** Patterns are static inline SVG; the value is the shape, not the reveal.

## 7. Component inventory

Marketing: `MarketingNav`, `Footer`, `HeroReplay` (wraps `ReplayPlayer` with the mock essay), `Beat` (how-it-works step), `FeatureRow`, `PricingCard`, `Faq`, `VerifyDropzone`, `MagicLinkForm`, `ThemeToggle`.

App: `AppShell` (rail + top bar), `EssayRow` + `Sparkline`, `ReplayPlayer` (sheet, scrubber, transport, speed, milestones, reduced-motion stepper), `ProvenanceStrip`, `SessionList`, `PasteTable`, `DeclarationPanel` (text + add-note form), `ExportMenu`, `StatTile`, `HourChart`, `Histogram`, `ReferralProgress`, `PlanCard`, `Paywall`, `ExtensionStatus`, `EmptyState`, `Loading`, `NotFound`.

Primitives: `Button` (primary/secondary/quiet), `Chip` (source kind), `Rule`, `Marginal` (mono caps label), `Sheet` (paper card).

## 8. Accessibility

WCAG 2.2 AA. Focus ring: 2px `--accent` offset 2px, never removed. Scrubber is a real `<input type="range">` with arrow-key steps and an `aria-valuetext` of "1,204 words, 38% through". All colours also carry a text label (typed/pasted) so provenance is never colour-only. Skip link to main. Theme toggle is a three-state `<select>`-like segmented control labelled System/Light/Dark.

## 9. Performance

Fonts via Google Fonts `<link>` with `preconnect`; hero is text and DOM, no images above the fold; Framer Motion is the only animation dependency; route-level code splitting with `React.lazy` so `/` ships only marketing code. Budget from DECISIONS: ≤200 KB gzipped JS on marketing pages.

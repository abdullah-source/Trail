# Trail design system: the security document

Owned by design. Source of truth for `web/src/design/document/**`, `web/public/document-preview.html` and the fonts in `web/public/fonts/archivo/` and `web/public/fonts/fragment-mono/`. It replaces the desktop system (`DESIGN-desktop.md`, `src/design/desktop/`) once engineering swaps the import (§13). Nothing outside those paths was touched to build it.

Reference page: `/document-preview.html` in `vite dev`, or open the file from disk. It is generated from `src/design/document/preview/Preview.tsx` with the real components, so it cannot drift from the kit (§14).

## 1. Concept

Trail gives writing a proof of origin: a replay of how it was written, every paste with its source, the sessions, and a signed record anyone can check in a browser. That makes it a document of value, so it should look like one. The references are banknote and passport craft: guilloche rosettes, microprint, watermarks, intaglio hairlines, serial numbers, a foil seal. They are carried out as a modern product: generous space, one strong sans, quiet motion with a spring in it.

Five rules follow from that:

- **The paper is banknote paper,** a cool mint-grey (`#E8EDE7`), never cream. Cards are a lighter sheet. Engraving ink (`#14213D`) carries all the text.
- **Security features carry real data.** The guilloche is generated from the record's own numbers (an essay's typing per minute). The microprint is the record's hashes. The serial is the first 8 hex digits of the record's hash. None of it is filler.
- **Foil means verified, and nothing else.** The holographic gradient appears on the verified seal and its hover only. Not on buttons, not in the hero background, not in a gradient headline.
- **Colour means provenance.** Typed is a deep guilloche green, pasted is an engraving sepia, signed is ink blue. Seal red is the broken seal and destructive actions only.
- **Motion shows the chain.** Dots travel the provenance path and light each checkpoint; content rises in once; buttons spring. Everything stops under reduced motion and the page still reads completely.

## 2. Palette

Two themes. **Daylight** is banknote paper. **Night vault** is an ink-blue black (`#0B1020`) with paper-light text. The guilloche glows faintly in it and the foil stays exactly as it is. Night vault applies under `prefers-color-scheme: dark` (unless `html[data-theme="light"]`), under `html[data-theme="dark"]`, and on any element with `data-surface="night"` (`data-surface="day"` forces Daylight inside a dark page). So a single band can be a vault, for example the Verify result on the home page.

| token | Daylight | Night vault | role |
|---|---|---|---|
| `--paper` | `#E8EDE7` | `#0B1020` | page background |
| `--paper-deep` | `#DDE4DC` | `#080C18` | alternate bands (`.band`) |
| `--sheet` | `#F6F8F4` | `#121A2E` | notes, certificates, the essay, stats |
| `--well` | `#EEF2EC` | `#0E1526` | sunken areas, bar tracks |
| `--frost` | paper @ 74 % | paper @ 72 % | the nav, under `backdrop-filter` |
| `--ink` | `#14213D` | `#E6ECE4` | text, primary button fill |
| `--ink-soft` | `#3F4B5E` | `#AEB8C6` | secondary text, eyebrows |
| `--ink-faint` | `#5E6A78` | `#8590A3` | placeholders, disabled, tertiary |
| `--on-ink` | `#F6F8F4` | `#0B1020` | text on an ink fill |
| `--rule` | `#C6CFC9` | `#253150` | hairlines (decorative only) |
| `--rule-strong` | `#737F79` | `#6A7898` | control borders (3:1 non-text) |
| `--crop` | `#5E6A78` | `#8590A3` | printer's crop marks |
| `--guilloche` | `#5E8C7A` | `#6FB39A` | line art only, never text |
| `--guilloche-2` | `#9DBCAE` | `#3C6A5E` | the second pass of a rosette |
| `--guilloche-ink` | `#3D6B5A` | `#7CC2A7` | guilloche green when it is read as text (eyebrow index, subline) |
| `--guilloche-hero/-card/-faint` | .55 / .16 / .08 | .60 / .20 / .10 | canvas opacities |
| `--seal` | `#B3261E` | `#F2766B` | serial numbers, the broken seal, errors |
| `--seal-fill` / `--on-seal` | `#B3261E` / `#FFF` | same | danger button |
| `--foil-1/2/3` | `#9FE7F5` `#C9A7F7` `#F7D79F` | same | the verified seal **only** |
| `--foil-ink` | `#14213D` | `#14213D` | engraving drawn on foil (foil is light in both themes) |
| `--typed` | `#1D5C47` | `#7FD3AE` | typed (deep guilloche green) |
| `--paste` | `#8A4A12` | `#E8B46C` | pasted (engraving sepia) |
| `--signed` (= `--accent`, `--focus`) | `#2546A0` | `#93ABFF` | signed (ink blue), links, focus, caret |
| `--mixed` / `--unobserved` | `#6B5714` / `#5F6873` | `#D8C172` / `#9AA4B5` | provenance strip and chips |
| `--*-wash` | 8–30 % tints | 10–28 % tints | highlighter over pastes, chip fills |
| `--glow` / `--glow-halo` | `#239A72` | `#8FF0C8` | the travelling dots |

The foil gradient is written inside `.seal-foil` (not as a shared variable) because it rotates with a per-seal `--foil-angle`; a custom property computed on `:root` would freeze the angle. The derived variables (`--accent`, `--focus`, the bridge names) are declared on `:root, [data-surface]` so they re-resolve inside a night island.

### Contrast (WCAG 2.2, computed from the token values)

Text needs 4.5:1. Control borders and focus need 3:1.

| token | Daylight | on paper | on sheet | on well | Night | on paper | on sheet | on well |
|---|---|---|---|---|---|---|---|---|
| ink | `#14213D` | 13.46 | 14.95 | 14.11 | `#E6ECE4` | 15.76 | 14.41 | 15.15 |
| ink-soft | `#3F4B5E` | 7.44 | 8.26 | 7.79 | `#AEB8C6` | 9.44 | 8.63 | 9.07 |
| ink-faint | `#5E6A78` | 4.65 | 5.16 | 4.87 | `#8590A3` | 5.87 | 5.37 | 5.65 |
| guilloche-ink | `#3D6B5A` | 5.13 | 5.70 | 5.38 | `#7CC2A7` | 9.13 | 8.35 | 8.78 |
| typed | `#1D5C47` | 6.62 | 7.35 | 6.94 | `#7FD3AE` | 10.67 | 9.75 | 10.25 |
| paste | `#8A4A12` | 5.77 | 6.40 | 6.04 | `#E8B46C` | 10.08 | 9.21 | 9.69 |
| signed | `#2546A0` | 7.19 | 7.98 | 7.53 | `#93ABFF` | 8.57 | 7.84 | 8.24 |
| mixed | `#6B5714` | 5.90 | 6.55 | 6.19 | `#D8C172` | 10.63 | 9.72 | 10.22 |
| unobserved | `#5F6873` | 4.77 | 5.29 | 4.99 | `#9AA4B5` | 7.53 | 6.89 | 7.24 |
| seal | `#B3261E` | 5.51 | 6.12 | 5.77 | `#F2766B` | 6.83 | 6.25 | 6.57 |
| guilloche (lines only) | `#5E8C7A` | 3.21 | 3.57 | 3.37 | `#6FB39A` | 7.74 | 7.08 | 7.44 |
| rule-strong (borders) | `#737F79` | 3.51 | 3.90 | 3.68 | `#6A7898` | 4.28 | 3.92 | 4.12 |

Other pairs:

- **Primary button:** on-ink on ink, 14.95 (Daylight) and 15.76 (Night).
- **Danger button:** white on seal-fill, 6.54.
- **Provenance fills:** on-typed on typed, 7.85 and 10.67.
- **Pasted text:** ink on the paste highlighter (blended), 11.67 and 7.78.
- **Verified seal:** foil-ink on each foil stop, 11.58, 7.88 and 11.54.
- **Chips:** text on their own 7 % tint stays at 4.84 or more in Daylight (unobserved is the lowest) and 5.74 or more at Night.
- **Bands:** ink-soft on paper-deep, 6.81 and 9.73.
- **Focus ring:** signed against sheet, 7.98 and 7.84.

`--guilloche` is 3.21:1 on Daylight paper, so it is never used for text; use `--guilloche-ink`. `--rule` is decorative: no control relies on it alone for its edge (fields, checkboxes and secondary buttons use `--rule-strong`).

## 3. Type

**Archivo** (variable, weight 100–900 and **width 62–125 %** in one file per subset) for everything set in words, **Fragment Mono** (400 only) for everything a machine wrote. Self-hosted from Google Fonts: `public/fonts/archivo/archivo-latin(-ext).woff2` (88 KB + 84 KB) and `public/fonts/fragment-mono/fragment-mono-latin(-ext).woff2` (15 KB + 7 KB). `src/design/document/fonts.css` holds the four `@font-face` rules with `font-stretch: 62% 125%`, so the expanded cut is just `font-stretch: 125%`. No second family is needed and nothing is fetched from Google.

| role | class | face | size | settings |
|---|---|---|---|---|
| hero headline | `.h-hero` | Archivo 640, stretch 118 % | `clamp(40px, 6.2vw, 80px)` | −0.03em, line-height 0.98 |
| section heading | `.h-section` | Archivo 620, stretch 115 % | `clamp(28px, 3.6vw, 48px)` | −0.022em, 1.04 |
| h1–h4 default | element | Archivo 620, stretch 112 % | per utility | −0.015em, 1.06, balanced |
| note title | `.note-title` | Archivo 620, stretch 112 % | 22 px | 1.12 |
| banknote numerals | `.numeral`, `.stat-value`, `.ticker-num` | Archivo 560, stretch 125 % | stat `clamp(36px, 4vw, 52px)` | tabular lining nums, −0.03em |
| display word | `.display` | Archivo 640, stretch 125 % | any | −0.025em |
| lede | `.lede` | Archivo 400 | 18 px / 1.55 | ink-soft, max 38rem |
| body | base | Archivo 400 | 16 px / 1.55 | |
| essay | `.essay` | Archivo 400 | 17 px / 1.7 | pastes highlighted |
| eyebrow, label, legend | `.eyebrow` (`.marginal`), `.field-label`, `.ppath-kicker` | Fragment Mono | 11 px | uppercase, +0.14em, ink-soft |
| hashes, timecodes, details | `.mono`, `.stat-detail`, `.ppath-detail` | Fragment Mono | 12 px | |
| serial | `.serial` | Fragment Mono | 12 px | +0.08em, seal red, "Nº 7F7B·F4EA" |
| microprint | `.microprint-edge` | Fragment Mono | 5.5 px | guilloche-ink; decorative |

Tailwind scale (`--text-*`): 2xs 11 · xs 12 · sm 14 · base 16 · lg 18 · xl 22 · 2xl 28 · 3xl 36 · 4xl 48 · 5xl 64 · 6xl 80. (xl to 6xl differ from the desktop scale; pages that relied on `text-2xl` = 32 px get 28 px.) `--font-serif` is an alias of the sans. `--doc-display/--doc-sans/--doc-mono` are plain variables, so the kit works without Tailwind (the preview has none).

The numero sign is written `Nº` (U+00BA, in the latin subset), not `№` (U+2116, not in the subset).

## 4. Layout, grid, shape

- **8 px grid.** Tailwind `--spacing` stays 4 px; use even steps. Fixed sizes: nav 60 px; buttons 32 / 40 / 48 px; fields 44 px; chips 22 px; provenance pins 44 px; note padding 24 px (32 px from 701 px); section rhythm 96 px (64 px on phones); heading-to-content gap 40 px (28 px).
- **Container:** `.doc-container`, max 1200 px, 16 px gutters (32 px from 640 px).
- **Grids:** content sits in 12 implied columns. In practice: hero 1.1fr / 0.9fr; four-up cards with 40 px gaps (48 px row gap, so crop marks never touch); certificate 1.6fr / 1fr beside the seal states.
- **Radii are small and engraved:** `--r-xs` 2 px (notes, certificates, which are trimmed paper), `--r-sm` 4 px (fields, stats, dialogs), `--r-md` 6 px (rare), `--r-pill` (buttons, chips, nav links only). Tailwind `rounded-sm/md/lg` = 4/6/6.
- **Hairlines:** 1 px `--rule` everywhere. `.rule-engraved` is a double hairline 3 px apart. The banknote inner frame (`data-frame`) is a second hairline 6 px inside the edge, and microprint runs in that gutter.
- **Depth:** one soft shadow, `--shadow-card`, and `--shadow-lift` on hover. No other shadows. Nothing glows except the dots, lit pins and the seal.

## 5. Signature components

All live in `src/design/document/`. Each signature visual is a framework-free **engine** (`*-engine.ts`, `motion.ts`) plus a thin React wrapper, so the same code drives the app and the static preview. No runtime dependency was added.

### `Guilloche` (`Guilloche.tsx`, engine `guilloche-engine.ts`)

A deterministic rosette or wave field on canvas, sharp at any pixel ratio, re-inked when the theme changes.

```ts
<Guilloche seed: string data?: number[] variant?: 'rosette' | 'waves' tone?: 'guilloche' | 'ink' | 'typed' | 'paste' | 'signed' | 'seal'
  intensity?: 'hero' | 'card' | 'faint' | number density?: number (0.4–2) lineWidth?: number
  animate?: boolean drift?: boolean fill?: boolean label?: string className? style? />
```

- **Determinism:** FNV-1a hash of the seed feeds mulberry32. Same seed and data, same engraving, forever.
- **Rosette:** an outer cord (8 phase-shifted lobed rings, 26–36 lobes) whose amplitude breathes with `data`; a layer of fanned petals (10–16 lobes); a hypotrochoid star at the centre; four engraved framing rings.
- **Waves:** banded sinusoid ropes across the width, with `data` as the amplitude envelope along x.
- **Data shaping:** `data` is normalised, smoothed (3-tap), cosine-interpolated, and periodic for rosettes. Pass an essay's per-minute typed characters and each record gets its own pattern. The hero caption says so.
- **Motion:** `animate` engraves the strands over 1.6 s on the rise curve the first time the canvas is seen. `drift` turns a rosette once per 240 s (CSS). Both are off under reduced motion.
- **Uses:**
  - hero art: `intensity="hero"`, with `animate` and `drift`
  - card backgrounds: waves, `card`
  - full-bleed hero background: waves, `faint`, masked to fade downward
  - the verify certificate: seeded with the record hash and its minutes
- **Lower-level exports:** `drawGuilloche(ctx, w, h, opts)` and `guillocheStrands(...)`, for exporting a PNG or a print-quality certificate.

### `Microprint` (`Microprint.tsx`)

`<Microprint text: string | string[] edges?: ('top'|'right'|'bottom'|'left')[] | 'all' size?: number (5.5) inset?: number className? style? />`. It renders the hashes, joined with " · " and repeated, at 5.5 px along the edges of its positioned parent. Inside a framed `Note` it sits in the 6 px gutter (`inset 0.5`). It is `aria-hidden`: it is a security feature, not copy, so the hash must also appear somewhere readable (the Certificate footer does this).

### `Seal` (`Seal.tsx`, engine `seal-engine.ts`)

`<Seal state?: 'verified' | 'pending' | 'broken' size?: number (160) ringText?: string label?: string zone?: HTMLElement | null orientation?: boolean (true) className? style? />`

- **Construction:** a 40-lobe scalloped disc (`--seal-mask`, in tokens), an engraved rosette of `<use>` copies (cheap DOM), a microtext ring on a `textPath` in Fragment Mono, a centre medallion and a glyph.
- **verified:** the conic foil (`#9FE7F5 → #C9A7F7 → #F7D79F`, twice round) under ink engraving. A soft-light sheen follows the pointer (`--mx/--my`), the foil hue rotates (`--foil-angle`), and the seal tilts up to 14° (`--rx/--ry`). On phones it follows device orientation; iOS asks for permission on the first tap of the seal. Hover saturates the foil slightly.
- **pending:** ink only on sheet, no foil. A dashed outer ring and the rosette turn slowly (14 s per revolution); the glyph is three dots.
- **broken:** seal red engraving on a red wash, cracked top to bottom. The right half is knocked 3 px off and rotated 5°, a dotted fracture line runs between the halves, and the glyph is a cross.
- **Accessibility:** `role="img"` with a state name ("Record verified", "Checking record", "Record altered: chain broken"). The seal never carries the verdict alone; the page says it in words too.

### `ProvenancePath` (`ProvenancePath.tsx`, engine `provenance-engine.ts`)

The Whistle-style diagram, data-driven.

```ts
type ProvenanceNode = { id; kind: 'doc' | 'session' | 'paste' | 'signature' | 'log' | 'check'; label: ReactNode;
  kicker?: ReactNode /* default "01 · Document" */; detail?: ReactNode; tone?: 'ink'|'typed'|'paste'|'signed'|'guilloche'|'seal'; icon?: IconName }
<ProvenancePath nodes dots?: number (3) duration?: number (6400 ms) label?: string className? />
```

- **Markup:** an `<ol>`, so screen readers get the chain in order. CSS lays it out as a row; under 620 px of container width (container query) it becomes a column with labels to the right of the pins.
- **Drawing:** the engine measures the pins and draws a gentle engraved wave through them (alternating ±14 px Bézier offsets), whichever way CSS laid them out. It re-measures on resize and once fonts load.
- **Dots:** 3 glowing dots, each a 2.75 px core, a blurred 9 px halo and a 56 px fading tail. They travel the path in 6.4 s, evenly spaced, and fade in and out at the ends.
- **Lighting:** each pin lights in its own tone (ring, 4 px tint halo, outer glow, 1.06 scale) when a dot is within 18 px, and holds for 650 ms. CSS handles the fade-out.
- **Efficiency:** pauses offscreen and when the tab is hidden.
- **Reduced motion:** no dots; every pin is drawn lit (`data-static`).
- **Default tones:** doc ink, session typed, paste sepia, signature signed blue, log guilloche.

### `Note`, `Certificate`, `Serial`, `Watermark`, `serialOf` (`Note.tsx`)

```ts
<Note as? label? serial? aside? title? titleAs? crop?=true frame? watermark?=true lift? guilloche?={seed, data?, variant?, tone?, intensity?, density?} | false
  microprint?: string | string[] tone?: 'seal' footer? id? className? style? children />
<Certificate hash: string hashes?: string[] data?: number[] ...NoteProps />   // framed, microprinted, serial = serialOf(hash), its own guilloche
<Serial value tone?: 'seal' | 'ink' />  serialOf('7f7bf4ea…') === '7F7B·F4EA'
```

The note is the document's card: a sheet, a 1 px hairline, a 2 px radius and a soft shadow.

- **Crop marks:** 10 px ticks 6 px outside each corner, drawn as one pseudo-element.
- **Head:** a mono-caps label at the top left. The top right holds the serial (`Nº 7F7B·F4EA` in seal red) or an `aside` (a status Chip).
- **Watermark:** an engraved rosette rises to 22 % on hover or focus-within (600 ms fade, 900 ms settle from −6°). It is clipped inside the card.
- **Lift:** `lift` adds a 2 px rise with `--shadow-lift`, for cards that are links.
- **Frame:** `frame` draws the banknote inner frame. `microprint` turns `frame` on.

### Kit components

| component | file | props |
|---|---|---|
| `Button` | `Button.tsx` | `ButtonHTMLAttributes & { variant?: 'primary' \| 'secondary' \| 'quiet' \| 'danger' \| 'default' \| 'ghost', size?: 'sm' \| 'md' \| 'lg', icon?: IconName, arrow?: boolean, ring?: boolean }` (forwardRef; `default` → secondary, `ghost` → quiet) |
| `IconButton` | `Button.tsx` | `icon, label` + button props; quiet, round |
| `ButtonLink` | `Button.tsx` | `to, external?, linkAs?: LinkComponent, variant?, size?, icon?, arrow?, ring?, className?, onClick?, children` |
| `buttonClass()` | `Button.tsx` | the class string, for `StoreLink` and other anchors |
| `Field` | `Field.tsx` | `id, label, hint?, error?, children, className?` |
| `TextField`, `TextArea` | `Field.tsx` | input/textarea props + `id, label, hint?, error?, wrapClassName?` (wires `aria-describedby`, `aria-invalid`) |
| `Checkbox`, `Radio` | `Field.tsx` | input props + `label, description?` (native inputs) |
| `Chip` | `Chip.tsx` | `kind?: ChipKind, plain?, title?, className?, children`; kinds: typed, pasted, paste, pasted-edited, ai, signed, mixed, unobserved, neutral, accent, web, self, internal, search, unknown, seal, guilloche |
| `Swatch` | `Chip.tsx` | `kind, className?` |
| `Stat` (alias `StatTile`) | `Stat.tsx` | `label, value, unit?, detail?, tone?: 'typed' \| 'paste' \| 'signed' \| 'accent', info?, bar?: 0..1, className?` |
| `Info` | `Stat.tsx` | `text, label?, className?`: "?" with tooltip on hover/focus, toggle on tap, Escape closes |
| `Nav` | `Nav.tsx` | `items: { label, to, current? }[], linkAs?, brandTo?, right?, label?, className?` |
| `Wordmark` | `Nav.tsx` | `to?, linkAs?, className?`: crop-mark logo + "Trail" at 125 % width |
| `ThemeToggle` | `Nav.tsx` | `className?`; same `trail.theme` key and first-paint contract as before |
| `Section` | `Section.tsx` | `id?, eyebrow?, index?, title?, titleAs?, lede?, align?: 'start' \| 'center', band?, reveal?=true, className?, children` |
| `Eyebrow` | `Section.tsx` | `index?, children, className?`: "02 —— WHO IT'S FOR" |
| `Reveal` | `Reveal.tsx` | `as?, delay?, stagger?, className?, style?, children` |
| `Ticker` | `Ticker.tsx` | `value, label, live?, size?, countUp?=true, className?`; `setTickerValue(el, n)` for static pages |
| `Icon`, `Mark` | `icons.tsx` | `name: IconName, size?=20, label?, strokeWidth?=1.5`; names: document, session, paste, signature, log, check, cross, arrow, external, copy, upload, shield, lock, key, link, search, menu, close, sun, moon, play, pause, info, warning, students, research, legal, writers, mark |

Engines and helpers exported from `index.ts`: `mountGuilloche`, `drawGuilloche`, `guillocheStrands`, `hashSeed`, `rng`, `envelope`, `mountProvenancePath`, `mountSeal`, `sealMask`, `scallopPath`, `lobedRing`, `mountReveal`, `whenVisible`, `prefersReducedMotion`, `onReducedMotionChange`, `onThemeChange`, `easeRise`, `cx`. `runtime.ts` (`mountDocument(root)`) mounts every engine on server-rendered or static markup.

Classes in `tokens.css` that pages can use directly: `.doc-container .band .section .section-head .eyebrow .eyebrow-index .eyebrow-rule .h-hero .h-section .display .numeral .lede .mono .link .essay .caret .prov-* .strike .tabular .hide-phone .rule-engraved .note .note-head .note-title .note-foot .serial .btn .btn-* .field .field-label .field-hint .field-error .field-inline .chk .radio .choice .chip .chip-* .swatch .stat .stat-* .info .ticker .nav .nav-link`.

## 6. Motion

All motion uses `--ease-rise: cubic-bezier(.22,1,.36,1)` unless it is a spring.

| what | spec |
|---|---|
| **Rise reveal** (`Reveal`, `.reveal`) | each direct child: opacity 0 → 1 and `translateY(20px)` → 0, 760 ms, rise curve, 90 ms stagger (up to 10 children), once, when 12 % is in view (bottom margin −8 %) |
| **Button** | hover: `translateY(-1px) scale(1.02)`, 320 ms `cubic-bezier(.34,1.56,.64,1)` (spring) plus a soft shadow. Press: `scale(.98)`, 120 ms. Trailing arrow nudges 3 px on hover |
| **Provenance dots** | 3 dots, 6.4 s per traverse, 56 px tail. Pin lights in 120 ms and fades over 500–700 ms after a 650 ms hold |
| **Guilloche** | engrave-in 1.6 s on first view (hero only by default). Rosette drift: 240 s per turn |
| **Seal** | pointer tilt up to 14°, tracking at 90 ms linear, settling back over 500 ms when the pointer leaves. Foil hue follows the pointer. Pending ring: 14 s per turn |
| **Note** | watermark 600 ms fade / 900 ms settle. `lift`: 2 px, 420 ms |
| **Ticker** | each digit reel rolls 900 ms, 60 ms apart, counting up from zero on first view. LIVE dot pulses every 2.2 s |
| **Caret** | 1.1 s soft blink (ease-in-out, not a hard step) |
| **Fields, chips, nav links** | colour and border at 160–200 ms |

**Reduced motion** (`prefers-reduced-motion: reduce`) is respected everywhere:

- The base layer zeroes every CSS animation and transition.
- `Reveal` shows content at once.
- Buttons don't move.
- `ProvenancePath` draws no dots and shows every pin lit.
- `Guilloche` skips the engrave-in and the drift.
- `Seal` neither tilts nor follows the device.
- The pending seal stands still.
- Every engine also listens for the preference changing mid-session.

## 7. Accessibility

- AA for every text pair (table in §2). Control borders meet 3:1 (`--rule-strong`). Focus is a 2 px `--signed` outline with a 2 px offset; fields use a 1 px inner and 3 px outer signed ring.
- Colour is never the only signal:
  - chips carry words
  - pasted text has an underline as well as the highlighter
  - the provenance strip has a legend and an `aria-label`
  - the seal has a name and the page states the verdict in text
- `ProvenancePath` is an ordered list. Its SVG is `aria-hidden`.
- `Guilloche`, `Microprint` and `Watermark` are decorative (`aria-hidden`); a hero `Guilloche` may take a `label`.
- `Info` is a real button with `aria-expanded` and an `aria-describedby` tooltip. It closes on Escape and on an outside tap.
- `TextField` wires its hint or error to `aria-describedby`. An error sets `aria-invalid` and is announced (`role="alert"`).
- `Ticker` digits are `aria-hidden`. A polite live region reads "1,284 students on the waitlist".
- `Nav` has a skip-link slot (keep the existing "Skip to content" link), `aria-current="page"`, and a menu toggle with `aria-expanded`/`aria-controls`.
- Native inputs are restyled but keep native keyboard and screen-reader behaviour.
- Nothing read at length is below 14 px. Mono caps are 11 px and only a few words long. Microprint (5.5 px) is never the only copy of anything.

## 8. Responsive

- **Breakpoints:** the content's, not devices'. Nav links fold into a menu sheet at 860 px. Hero, verify and kit grids go to one column at 900 px. Four-up cards go to two at 1040 px and one at 620 px. `ProvenancePath` turns vertical below 620 px of its own width (container query). `.hide-phone` hides at 700 px.
- **Overflow:** no horizontal page scroll. Every grid column is `minmax(0, 1fr)`, notes are `minmax(0,1fr)` grids, and hashes wrap (`overflow-wrap: anywhere`) or truncate with an ellipsis in footers. Measured at 400 px: `scrollWidth === 400`.
- **Phones:**
  - Hero headline floors at 40 px, with the subline at no less than 24 px.
  - The hero rosette is capped at 360 px and drops below the copy.
  - Buttons wrap and keep 40 px touch targets (44 px fields, 44 px menu rows).
  - The certificate moves its seal above the details.
  - The seal follows device tilt.
- **Gutters:** 16 px on phones, 32 px from 640 px.

## 9. Page-by-page

| page | composition |
|---|---|
| **Home: hero** | `Nav` (frosted; How it works, Demo, Verify, Install, Pricing; right: `ThemeToggle`, "Log in" `nav-link hide-phone`, primary pill "Get Trail"). A full-bleed faint `Guilloche variant="waves"` behind the hero, masked to fade downward. Left, inside a `Reveal`: `Eyebrow index="Nº 01"` "Proof of origin"; `h1.h-hero` "**Proof of origin for anything you write.**" with the subline "Starting with your essays." as a block in `--guilloche-ink` at 0.46 em, 440 weight; a `.lede`; primary lg pill "Get Trail for Chrome" with arrow and secondary lg "Watch a replay" (play icon); mono line "Free in beta · your writing stays on your device". Right: a square plate holding a `Guilloche` rosette (`intensity="hero" animate drift`, seeded from the demo essay's minutes) with the verified `Seal` (150–168 px, `zone` = the plate) at its centre. Corner microcopy "Series S · 2026", serial top right, "46 min · 1,840 words" bottom left, and the caption "Drawn from one essay's typing, minute by minute. Every record engraves its own." |
| **Home: how a record is made** | `Section index="02" eyebrow="How a record is made" title="Every line has a trail."`. A framed `Note label="Record chain" serial` holding `ProvenancePath` with doc → session → paste source → signature → public log, using the demo record's real values |
| **Home: who it's for** | `Section band index="03" title="Students now. Everyone who writes, next."`. Four `Note crop lift` cards: Series S Students (`aside` Chip typed "Now", a line, primary "Get Trail for Chrome"); Series R Researchers, Series L Lawyers, Series W Writers (`aside` Chip neutral "Soon", a line, an email `field`, a secondary "Join the waitlist" with an `aria-label` naming the list). Each waitlist posts its own `source`: `research`, `legal`, `writers` (students keep the default). A `Ticker` of the student waitlist with `live` can sit under the heading |
| **Home: the rest** | Keep every caption and every `Info` "?". Sections alternate paper / `band`. Stats become `Stat` with expanded numerals. Pricing is two or three `Note lift` cards with the price as `.numeral`. FAQ uses the existing `Disclosure`, on `.rule-engraved` |
| **Demo** | The replay player in a `Note frame` with `serial` from the demo hash: the essay in `.essay` (pastes `.prov-paste` with a source `Chip`, signed-blue `.caret`), the transport row (`.transport`, an ink thumb on a 4 px track), `.prov-strip` with legend, then four `Stat`s (Typed, Pastes, Sessions, Time). Sessions and Pastes are tables inside notes; the paste source is a `Chip`. A small `ProvenancePath` for this record closes the page |
| **Verify** | A certificate inspection. Before a file: a dashed drop zone inside a `Note` ("Drop a .trail file. Checked in this browser, nothing uploaded"). While checking: the `Seal state="pending"` and the 14 checks rising in one by one (`Reveal`), each with a check or cross icon and a mono check name. Result: a `Certificate hash data` with `label="Certificate of origin"` and the essay title, a definition list (Author, Written, Typed in `--typed`, Pasted in `--paste`, Signature mono, Checks), the verified `Seal` with Chip "Signature valid", and a footer with the full hash and Copy. Broken: the same certificate with `tone="seal"`, `Seal state="broken"`, the failing check named in words ("Chain broken at event #412"), and "Now tamper with it" swapped for "Report this". The result band may be `data-surface="night"` for drama; the seal looks the same in both |
| **Install** | `Section` "Install Trail" with a four-step `ProvenancePath`-styled list (`kind="check"`: Add to Chrome, Pin it, Write a paragraph, Watch it replay) or numbered notes. The store button is the primary pill. Below that, the waitlist form (`TextField` + primary) |
| **Login** | A narrow centred `Note crop frame` titled "Log in" with one `TextField` ("School email", hint "We send one link. No password.") and a primary full-width pill. A faint rosette `Guilloche` sits behind the page, seeded "login" |
| **App shell** | The same frosted `Nav` with app items (Essays, Time, Patterns, Invite, Settings). The right slot holds `ThemeToggle` and the account email (`hide-phone`). No side rail. Trial days are a `Chip` in the nav; the paywall is a `Note` dialog (`.dialog`). "Read-only on phones" is a single `Note` line at the top |
| **Essays** | A list of `Note lift` rows (or one note with `.rule-engraved` rows): document icon, title, editor, last edit, a typed-share `Chip`, and the serial of the essay's latest record. Empty state: one note, one line, "Open Google Docs" |
| **Essay (replay)** | As Demo, with the declaration below in a framed `Note label="AI-use declaration" aside={<Chip>Draft</Chip>}` and "Sign and export" as a primary lg pill with the signature icon |
| **Time / Patterns** | `Stat` grid with expanded numerals. Bars are `.progress` (6 px pill tracks) in typed green; the heat map uses the typed wash scale; observations in `.essay` with the guilloche-dot bullet |
| **Settings / Invite** | Notes with labels (Account, Plan, Extension, Data). Delete is the `danger` pill and opens a dialog. The invite link is a read-only `.field` with a Copy secondary button |
| **404** | A `Note` with `serial="404·0000"`, one sentence, and a secondary "Back to Trail" |

## 10. What not to do

- No cream, beige or parchment. The paper is cool mint-grey.
- No foil outside the verified seal: no holographic buttons, gradient headlines or rainbow borders. No violet anywhere else, and no purple-on-black.
- No seal red for emphasis: it means broken or destructive, plus the serial number.
- No fake security features. Microprint is the real hashes, serials are the real hash prefix, and the guilloche comes from the real seed and data. Don't print a serial on something that has no hash. "Nº Soon" is wrong; use an `aside` Chip.
- No skeuomorphic money: no portrait ovals, no denominations, no currency signs, no "100". The craft is borrowed, not the banknote.
- No stacked effects: one guilloche per view at hero intensity; card guilloches at `card` or `faint` only. Never put a guilloche behind body text above `card` intensity.
- No motion beyond §6. Nothing loops on screen except the dots, the drift, the pending ring, the caret and the LIVE pulse. No parallax, no scroll-jacking, no cursor trails.
- No rounded cards (2 px is the maximum for notes). Pills are for buttons, chips and nav links only.
- No uppercase Archivo headlines. Uppercase is for the 11 px mono labels only.
- Keep the copy bans from DECISIONS §7: detect, prove, cheating, flag. The hero's "Proof of origin" is the one sanctioned noun.
- No new runtime dependencies: everything here is React, DOM and canvas.

## 11. Files

```
web/src/design/document/
  tokens.css            palette, @theme, base, every class (generated; see §14)
  fonts.css             Archivo (wght + wdth) and Fragment Mono @font-face, self-hosted
  index.ts              the barrel
  cx.ts  motion.ts      class joiner; reduced motion, theme change, visibility, easeRise, mountReveal
  guilloche-engine.ts   PRNG, envelope, rosette / waves geometry, drawGuilloche, mountGuilloche
  provenance-engine.ts  path through pins, dots, lighting
  seal-engine.ts        seal geometry (scallop, lobed rings, crack), mask, pointer/orientation tilt
  Guilloche.tsx Microprint.tsx Seal.tsx ProvenancePath.tsx Note.tsx
  Button.tsx Field.tsx Chip.tsx Stat.tsx Nav.tsx Section.tsx Reveal.tsx Ticker.tsx icons.tsx
  runtime.ts            mountDocument(): engines on static markup
  preview/Preview.tsx   the reference page, using the real components
  preview/preview.css   the reference page's layout (no Tailwind there)
  build/gen-tokens.mjs  writes tokens.css from the palettes + build/tokens.body.css
  build/tokens.body.css @theme, base, components, legacy bridge (the hand-edited part)
  build/build-preview.mjs
web/public/fonts/archivo/archivo-latin.woff2, archivo-latin-ext.woff2
web/public/fonts/fragment-mono/fragment-mono-latin.woff2, fragment-mono-latin-ext.woff2
web/public/document-preview.html   generated
```

Engine files are named `*-engine.ts` on purpose. `guilloche.ts` beside `Guilloche.tsx` collides on case-insensitive file systems (macOS), and TypeScript refuses it.

## 12. The legacy bridge

`tokens.css` restyles the class names that the desktop kit and today's pages emit, so swapping the CSS import is safe before any page is rewritten:

- **Windows:** `.win` becomes a note with a mono-caps title strip. The title bar's `right` slot (the timecode) prints in seal red, like a serial. The close and zoom boxes are hidden.
- **Menu bar:** `.menubar` becomes the frosted bar.
- **Surfaces:** `.panel` and `.bevel-*` become sheets.
- **Dialogs:** `.dialog` gets the lift shadow and a blurred backdrop.
- **Controls:** `.progress` becomes a 6 px pill track, `.range` becomes a 4 px track with an ink thumb, and `.prov-strip` becomes a 10 px segmented strip.
- **Pixel art:** `.desk` and `.dither` go flat.
- **Variables:** the desktop names (`--chrome`, `--frame`, `--bevel-*`, `--desk`, `--margin`, `--select`) map onto document tokens, and their Tailwind utilities (`bg-chrome`, `border-frame` and so on) keep working.

Delete the bridge section (the last block of `build/tokens.body.css`) with the desktop kit, then regenerate.

## 13. Adoption (engineering)

**Step 1: the import swap** (re-themes every page at once). In `src/index.css`, change

```css
@import "./design/fonts.css";
@import "./design/desktop/fonts.css";
@import "tailwindcss";
@import "./design/desktop/tokens.css";
@import "./styles/app.css";
```

to

```css
@import "./design/document/fonts.css";
@import "tailwindcss";
@import "./design/document/tokens.css";
@import "./styles/app.css";
```

Plex, Newsreader and Pixelify are no longer referenced. Update `index.html`'s `theme-color` metas to `#E8EDE7` (light) and `#0B1020` (dark). The first-paint theme script and the `trail.theme` key are unchanged.

**Step 2: `src/components/ui.tsx` re-exports from the document kit.** Replace the `../design/desktop` imports and exports with:

```ts
import { Button as DocButton, ButtonLink as DocButtonLink, type ButtonProps as DocButtonProps, type ButtonLinkProps as DocButtonLinkProps } from '../design/document';
export { cx, Info, Chip, Swatch, Checkbox, Radio, TextField, Stat, StatTile, Icon, Note, Certificate, Seal, Guilloche, Microprint, ProvenancePath, Ticker, Reveal } from '../design/document';
export type { IconName, ChipKind, ButtonVariant, ButtonSize } from '../design/document';
// Button keeps its name; variant accepts 'primary' | 'secondary' | 'quiet' | 'danger' and the old 'default' | 'ghost'.
export const Button = DocButton;
export function ButtonLink(props: Omit<DocButtonLinkProps, 'linkAs'>) { return <DocButtonLink {...props} linkAs={Link} />; }
```

- **`Sheet`:** returns `<Note crop={false} watermark={false}>`.
- **`SectionHead`:** renders `Eyebrow` + `h2.h-section` + `.lede`.
- **`Loading`:** a `.caret` plus mono text.
- **`EmptyState`:** a `Note`.
- **`Field` and `inputCls = 'field'`:** keep working as they are.
- **`Window`, `Dialog`, `ProgressBar`, `ScrollArea`, `Panel`, `Bevel`, `MenuBar`, `DesktopIcon`, `DesktopPattern`:** have no one-to-one replacement. The bridge styles them until each page is rewritten:
  - `Window` / `Panel` → `Note`
  - `MenuBar` → `Nav`
  - `DesktopPattern` → a plain `div`
  - `ProgressBar` → `.progress`
  - `ScrollArea` → `div.scroll`
  - `Dialog` keeps `.dialog`

Icon names that change: `clock` → `session`, `magnifier` → `search`, `disk` → `upload`, `folder` → `document`, `back` / `forward` → `play` / `pause` plus `arrow` (rotate for back), `grow` → none.

**Step 3: `src/design/components.tsx` re-exports and rebuilds the marketing shell on the kit:**

- **`Nav`:** `<Nav items={LINKS.map(l => ({ ...l, current: here(l.to) }))} linkAs={Link} right={<><ThemeToggle /><Link className="nav-link hide-phone" to="/login">Log in</Link><StoreLink className={buttonClass({ variant: 'primary', size: 'sm' })}>Get Trail</StoreLink></>} />`. Keep the skip link above it.
- **`ThemeToggle`, `Wordmark`, `Mark`:** re-export from `./document`.
- **`Section`:** becomes the document `Section`. Map the old props: `label` → `eyebrow`, `code` → `index`, and the heading moves into `title`. Drop `wide/offset/icon/chrome/inactive/open/resizable`.
- **`Desk`:** becomes a `.doc-container` grid.
- **`MarketingLayout`:** drop `DesktopPattern`.
- **`Card`:** becomes `Note`.
- **`Stat`:** becomes the document `Stat`.
- **`Badge`:** becomes `Chip`.
- **`Heading`:** uses `.h-hero` / `.h-section`.
- **`Bullet`:** uses a 6 px `--guilloche` dot.
- **`PriceCard`:** a `Note lift` with `.numeral` price.
- **`FadeUp` / `Stagger` in `motion.tsx`:** become `Reveal`.

**Step 4: retire the desktop.** When nothing imports them, delete:

- `src/design/desktop/`
- `src/design/tokens.css`
- `src/design/fonts.css`
- `public/fonts/{pixelify-sans,ibm-plex-sans,ibm-plex-mono,newsreader}`
- `public/desktop-preview.html`
- `DESIGN-desktop.md`

They stay in git history. Then delete the bridge section (§12) from `build/tokens.body.css` and regenerate.

## 14. Regenerating

- **Preview:** from `web/`, run `node src/design/document/build/build-preview.mjs`. It renders `Preview.tsx` to static markup (react-dom/server, at build time), bundles `runtime.ts` with Vite's own esbuild into an inline script, and inlines `fonts.css` (URLs made relative), `tokens.css` (the `@theme` block removed) and `preview.css`. The page has no React at runtime. Fonts resolve from `public/fonts/` both in `vite dev` and from disk.
- **Tokens:** `tokens.css` is generated so the night-vault block (needed under the media query and under `[data-theme="dark"], [data-surface="night"]`) cannot drift. Palettes live in `build/gen-tokens.mjs`, everything else in `build/tokens.body.css`. From `web/`, run `node src/design/document/build/gen-tokens.mjs`, then rebuild the preview.
- **Screenshots (2026-10-15):** `doc-1280-00..10.png`, `doc-400-00..15.png`, and the contact sheets `doc-1280-sheet*.png` / `doc-400-sheet*.png`, in the design session's scratchpad.

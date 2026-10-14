# Trail design system: the desktop

Owned by design. Source of truth for `web/src/design/desktop/*`, `web/public/desktop-preview.html` and the fonts under `web/public/fonts/pixelify-sans/`. This replaces the manuscript system in `DESIGN.md` once engineering swaps the import (§11). Nothing in `src/app` or `src/lib` was touched to build it.

## 1. Concept: the desktop

A Trail page is a desk with windows open on it. Not a parody of 1991, and not a retro skin: a modern product that uses the one visual language everybody already knows how to read, so the record looks like a record and not like a landing page.

Four facts follow from that:

- **Everything lives in a window.** A window has a striped title bar, a close box, sometimes a zoom box, a 1 px black frame and a two-pixel drop. Its inside is paper (white by day, near-black after dark). The essay replay is a player window; the verifier is a dialog; the time page is a desk accessory; patterns and settings are control panels; the installer is an installer.
- **Chrome carries only ink.** Title bars, the menu bar, buttons, panels and stat tiles are system grey with black text. No colour sits on chrome. This is both period-true (System 7 chrome was monochrome) and what keeps every text pair at WCAG AA.
- **Colour lives on paper, and means provenance.** The three provenance colours are the one modern element: typed green, pasted amber, signed blue. They appear on the paper inside windows: provenance strips, highlighter over pasted text, chips, stat values on their plates, links, the caret, progress. Nothing else is coloured. There is no red margin any more.
- **Only the record moves.** The replay types, the caret blinks, a window zooms open in four frames. Nothing else animates, ever.

The desk is a dithered grey; the menu bar runs along the top of every page; pixel icons on a 16 px grid name the parts of the product (document, folder, clock, chain link, key, magnifier, disk, warning, check).

Banned, unchanged from DECISIONS §7: gradient blobs, glassmorphism, purple-on-black, stock students, emoji headers, the words detect/prove/cheating/flag. Added: see §9.

## 2. Palette

Two themes. **Daytime** is a grey desk with white paper. **After Dark** is not an inversion: a dark grey desk with the same chrome logic (grey faces, light highlight top-left, dark shadow bottom-right), the frame goes light grey so windows still have an edge, and the paper goes near-black so a 1 am replay does not glare. Provenance and accent use the founder's exact values.

| token | Daytime | After Dark | role |
|---|---|---|---|
| `--paper` | `#A9A9A9` | `#262626` | the flat desk (what `bg-paper` paints); the pattern below averages to it |
| `--desk` / `--desk-dot` | `#B4B4B4` / `#9E9E9E` | `#2A2A2A` / `#1F1F1F` | the 2 px checker dither (`--desk-pattern`) |
| `--sheet` | `#FFFFFF` | `#161616` | paper: the inside of a window, dialogs, the essay |
| `--well` | `#F0F0F0` | `#1F1F1F` | sunken fields and list wells |
| `--chrome` | `#DCDCDC` | `#3D3D3D` | window faces, title bars, menu bar, buttons, panels, tiles |
| `--chrome-deep` | `#C0C0C0` | `#2E2E2E` | hovered faces, icon greys, scrollbar dither partner |
| `--frame` | `#000000` | `#9A9A9A` | the 1 px line around everything |
| `--bevel-hi` / `--bevel-lo` | `#FFFFFF` / `#808080` | `#6E6E6E` / `#0E0E0E` | top-left highlight, bottom-right shadow inside a frame |
| `--title-stripe` | `#6E6E6E` | `#8A8A8A` | the six-ish lines in an active title bar |
| `--shadow-ink` | `#000000` | `#000000` | the 2 px window drop (`--shadow`) |
| `--ink` | `#000000` | `#E8E8E8` | text |
| `--ink-soft` | `#4D4D4D` | `#B0B0B0` | secondary text (6.2:1 on chrome, 8.5:1 on sheet / 5.0:1, 8.3:1) |
| `--ink-faint` | `#767676` | `#7A7A7A` | 4.5:1 on sheet only: large, decorative or disabled |
| `--rule` | `#9E9E9E` | `#4A4A4A` | hairlines inside paper (table rows) |
| `--rule-strong` / `--margin` | `#000000` | `#9A9A9A` / `#E8E8E8` | control borders are frames; `--margin` is now the pencil tick (list bullets, scrubber ticks), never red |
| `--typed` | `#1C6B4C` | `#5FCB84` | typed share, typed cells, "looks like a person" |
| `--paste` | `#A84E0C` | `#E0A64B` | pasted share, paste cells and chips, the broken-chain warning fill |
| `--mixed` / `--unobserved` | `#7F6410` / `#6A6A6A` | `#D6B65A` / `#9A9A9A` | provenance strip only |
| `--paste-wash` | `rgba(224,166,75,.38)` | `rgba(224,166,75,.30)` | highlighter over pasted text (ink stays on top of it) |
| `--on-typed` / `--on-paste` | `#FFFFFF` | `#161616` | text on a typed or pasted fill (ink on green would be 3.3:1) |
| `--accent` | `#1E3EA3` | `#6B8CFF` | signed blue: links on paper, focus, caret, default progress |
| `--accent-ink` | `#FFFFFF` | `#0B1020` | text on accent |
| `--select` / `--select-ink` | = accent | = accent | text selection |

Contrast (computed, WCAG 2.2 AA at 4.5:1 for text):

- `ink` and `ink-soft` pass on sheet, well, chrome and paper in both themes (ink-soft on the Daytime desk is 3.6:1, so the desk carries only ink; icon labels sit on a sheet plate).
- `typed`, `paste`, `mixed`, `unobserved`, `accent` pass on sheet and well in both themes. On Daytime chrome `paste` is 4.07:1 and on After Dark chrome `accent` is 3.53:1: hence the rule that colour never sits on chrome. Stat values are therefore drawn on a sheet plate inside the chrome tile; chips have a sheet background; links on chrome (`.on-chrome .link`) are ink.
- Inverse (sheet on ink, the pressed and selected state) is 21:1 / 14.8:1. Accent-ink on accent is 9.2:1 / 6.2:1.
- `ink-faint` is 4.5:1 on Daytime sheet and 4.2:1 on After Dark sheet: large text, the "skipped" check, and disabled controls (exempt) only.

Dark applies under `@media (prefers-color-scheme: dark)` unless `html[data-theme="light"]`, and under `html[data-theme="dark"]`, exactly as before; `ThemeToggle` and the first-paint script in `index.html` need no change. Tailwind utilities keep their names (`bg-paper text-ink border-rule bg-typed`) and gain `bg-chrome bg-chrome-deep border-frame bg-bevel-hi bg-bevel-lo bg-desk bg-select text-select-ink`.

## 3. Type

**Decision: Pixelify Sans for display, IBM Plex Mono for chrome and the essay, IBM Plex Sans for prose.** Tested side by side at `scratchpad/fonttest.png`:

- **Pixelify Sans** (Google Fonts, OFL, variable 400 to 700; self-hosted at `public/fonts/pixelify-sans/`, 25 KB for latin + latin-ext + cyrillic) is a pixel face with real lowercase, proper proportions and descenders. At 16 px / 600 it is fully legible in a 24 px title bar ("Hamlet and the cost of waiting", "Where each line came from"); at 24 to 64 px / 500 it makes a confident headline that is unmistakably not a serif-and-cream AI page. Below 16 px it cramps, so it is never used smaller.
- **Silkscreen** is rejected. It is effectively uppercase-only (its lowercase is tiny caps), needs wide tracking, is unreadable at 8 to 12 px on a modern display and turns into a blob at 48 px bold. It reads as a video-game HUD, which is the parody we are avoiding.
- **VT323** is rejected per the brief (CRT).
- **IBM Plex Mono** 400 (already self-hosted) is the system face: menu bar, buttons, labels, chips, tables, timecodes, stats detail, field text, all at 14 px (12 px for mono caps). It is also the essay text inside the player and the declaration at 15 px / 1.6, the way Notepad and TeachText were monospace, which has a real benefit: pasted spans align to the character grid under the highlighter.
- **IBM Plex Sans** 400 / 600 (already self-hosted) is body copy for anything longer than a paragraph, at 16 px / 1.55, because a 60-character line of mono reads slowly. Also dialog body text at 14 px.
- There is no serif on the desktop. `--font-serif` is aliased to the sans so leftover `font-serif` utilities do not bring Newsreader back; the Newsreader files can be deleted when the old system is retired.

Fonts are self-hosted like the current ones; nothing is fetched from Google. `src/design/desktop/fonts.css` carries the three `@font-face` rules and is imported after `src/design/fonts.css`.

Scale (`--text-*`, rem): 0.75 / 0.875 / 1 / 1.125 / 1.5 / 2 / 2.5 / 3 / 4 = 12 / 14 / 16 / 18 / 24 / 32 / 40 / 48 / 64 px. Whole multiples suit the pixel face. Title bars 16 px / 600; h1 48 px on desktop and 32 px on phones; h2 32; h3 24; dialog titles 24; stat values 32. Headings are weight 500, letter-spacing 0, line-height 1.1. Numbers are `tabular-nums`. Mono caps (`.marginal`) are 12 px, 0.08 em tracking, `ink-soft`, and only ever a few words.

## 4. The window metaphor, page by page

Every page is the desk (`DesktopPattern`) with the `MenuBar` along the top and one or more `Window`s or `Dialog`s on it. Window titles are `h2` (or `h1` for the page's main window) so a page reads as an outline to a screen reader.

| page | what it is | details |
|---|---|---|
| **Marketing home** | the desktop with windows open | Menu bar: Trail mark, How it works, Live demo, Pricing, Privacy, Verify; right: theme, Log in, "Get Trail" as a bevelled button. A one-line display headline sits directly on the desk (ink only). Each section is a window: the hero replay is the player window (title "Replay", timecode at the right of the title); Sessions and By class are desk accessories; "Where each line came from" is a window; the declaration is a document window; pricing is a dialog with a radio per plan; install is the installer dialog (§Install). Desktop icons on the right edge double as nav: Essays, Verify, Install. The old margin timecodes become the `right` slot of each title bar. |
| **App shell** | menu bar instead of the margin rail | `MenuBar` items: Essays, Time, Patterns, Invite, Settings; right slot: clock (desk accessory, mono), theme toggle (sun/moon pixel icon), account email (hidden on phones with `hide-phone`). Below it the desk with the page's windows. Trial days and the paywall are a dialog, not a rail footnote. The "read-only on phones" notice is an inactive window at the top. |
| **Essays list** | a folder window | Title "Essays" with the folder icon; a `ScrollArea` list where each essay is a row with the document icon, title, editor, last edit, typed share chip. Empty state: the window with one line of text and an "Open Google Docs" button. |
| **Essay replay** | a player window with transport controls | Title: document icon, essay title, `right` = `00:48 / 02:55`. Body: the essay sheet (`.essay`, mono, highlighter over pastes with a source chip, blinking caret). Then the `.transport` bar: step back, play/pause (pressed state inverts), step forward as `IconButton`s, the bevelled scrubber (`.range`), "session 2 of 4". Under it: the provenance strip (`.prov-strip`), its legend, and the five `StatTile`s. Sessions, Pastes, Open-while-writing and Rhythm are each a window below, tables inside `ScrollArea`s. The declaration is a document window titled "AI-use declaration" with "draft" in the title's right slot, "Sign and export" as the primary button with the key icon. The `Info` "?" stays on every stat. |
| **Verify** | a "Disk First Aid" dialog with a checklist | `Dialog` with the disk icon at 32 px. Line 1: the file name, counts, "checked in this browser, nothing uploaded". A segmented `ProgressBar` while checks run ("14 of 14"). A checklist: pixel check in typed green for PASS, an em dash in ink-faint for SKIP, the warning icon filled amber for FAIL, each with the plain-English line and the check name in mono under it. The verdict sentence in bold. Actions: "Now tamper with it", "Done" with the ring. The drop zone before a file is chosen is a sunken `Bevel` with a dashed inner line. A broken chain opens a second `alertdialog` ("Chain broken at event #412") with the amber warning icon. The three explainer steps become three small inactive windows. |
| **Time** | a desk accessory | A narrow `Window` with the clock icon. Range as three `Radio`s. The headline number in display 40 px with the delta in mono. Class bars are typed-green `ProgressBar`s with label and "2h 44m · 3 items". The heat map is a 7 × 24 pixel grid (`.heat`), the one chart that the pixel grid fits perfectly. Observations as a list with square pixel bullets. Footer line: "Counted on this computer. No teacher view, no limit, no sharing." |
| **Patterns** | a control panel | `Window` with `chrome` body, magnifier icon. Four `StatTile`s across the top; then `Panel`s with legends: "Hours" (pixel bar chart of local hours), "Session length", "Revision", each a `Panel` of bars. Nothing scrolls inside. |
| **Settings** | a control panel | `Window` with `chrome` body, key icon. `Panel`s: Account, Plan (a `Radio` per plan with the price, "Continue" buttons), Extension (status chip, "Connect" button), Data (export and delete; delete is a `Dialog` with the warning icon and the ring on "Cancel"). `TextField`s for anything typed. |
| **Install** | a software installer dialog | `Dialog` titled "Trail Installer" with the disk icon. A four-step list with a segmented `ProgressBar` of fixed 20 segments that fills as the student goes: Add to Chrome, Pin it, Write a paragraph, Watch it replay. "Install" (ring) and "Watch the demo first". The waitlist form is the "Register your copy" `TextField`. |
| **Login / Invite / Welcome / 404** | dialogs and windows | Login: a dialog with the key icon and one `TextField`. Invite: a window with the chain-link icon and the link in a sunken field with "Copy". Welcome: the player window with a prompt where the essay will be. 404: a plain window titled "Not found" with the document icon, one sentence and a button; not an alert. |

Demo and Pricing follow the Essay and Settings patterns. Privacy and Terms are a single document window with `.prose` inside.

## 5. Spacing and layout

8 px grid. Tailwind's `--spacing` stays 4 px so existing utilities keep their size; use even steps (`gap-2 p-4 py-6 gap-8`) so everything lands on 8 px, and odd steps only for 1 px frames and 4 px inner gaps inside a control. Fixed sizes: menu bar 24 px, title bar 24 px, close and zoom boxes 12 px on 20 px plates, buttons 32 px (large 40, small 24, icon 24), fields 32 px, checkbox and radio 18 px, progress 14 px, scrollbars 16 px, window body padding 16 px, dialog padding 24 px, panel padding 16 px, desktop icons 32 px on 96 px plates. Radii are 0 everywhere (`--radius-*: 0`). Windows have a 2 px drop; dialogs a double frame (1 px, 1 px gap, 2 px) and a 4 px drop; nothing else has a shadow. Page container `max-w-6xl`, 16 px gutters on phones and 24 px from `sm`. Windows sit in a two-column grid (`minmax(0, 1fr)` each, 24 px gap) with the second column offset 40 px down so the desk looks used; desktop icons take a 112 px third column.

## 6. Motion

- **Window zoom-open, 180 ms.** A window or dialog that appears after load (a route change, a dialog) plays `.win-open`: scale 0.92 to 1 and opacity 0 to 1 in `steps(4, end)`, four discrete frames, a nod to the old zoom rectangles without drawing them. Windows present at first paint do not animate.
- **The caret blinks** at 1 s, `steps(2)`.
- **The replay itself** keeps its existing rhythm from `ReplayHero` and `ReplayPlayer` (it is content, not decoration). The one-time left-to-right light-up of the provenance strip stays.
- **Nothing else.** No hover transitions (states switch instantly: hover is a deeper face, pressed is inverse), no fade-ups, no stagger, no parallax. `FadeUp` and `Stagger` from `motion.tsx` should render plain divs on desktop pages. `--ease-out` is `steps(3, end)` for the rare transition that must exist.
- **Reduced motion:** `tokens.css` zeroes every animation and transition under the media query, so the window appears in place and the caret stays solid; the replay's reduced-motion fallback (three static drafts) is unchanged.

## 7. Accessibility

- Every text/background pair in §2 meets AA; the two near-misses are designed out by the chrome-carries-only-ink rule. `ink-faint` is reserved for large, decorative or disabled text.
- Focus: 2 px `--accent` outline with 2 px offset on every interactive element. Menu items and the pressed close box show focus by inverting (ink on sheet, 21:1 / 14.8:1). The scrubber thumb gets the outline directly. The dialog's default button carries a 3 px ring that turns accent on focus.
- `Window` sets `aria-labelledby` to its title; the title is a heading. `Dialog` is `role="dialog"` (or `alertdialog`), `aria-modal` and focused when modal, closes on Escape. `MenuBar` is a `nav` with `aria-current="page"`; the phone pull-down is `aria-expanded`/`aria-controls`. `ProgressBar` is `role="progressbar"` with values. `ScrollArea` is a focusable, labelled region so it scrolls from the keyboard. Icons are `aria-hidden` unless given `label`. Checkboxes and radios are native inputs (skinned with `appearance: none`), so they keep keyboard and screen-reader behaviour.
- Pixel display type is used only for titles and headlines, never for paragraphs. Body text is 16 px sans or 15 px mono; nothing read at length is smaller than 14 px.
- Colour is never the only signal: provenance cells also carry a title, chips carry words, verify rows carry an icon and a word.
- Native inputs and scrollbar buttons use per-theme data-URI glyphs generated from the same pixel maps as the icons, so they stay crisp and legible in both themes.

## 8. Responsive

- Windows stack to one column at 700 px (`.desk-area` goes `minmax(0, 1fr)`); desktop icons move above the windows as a three-across row (a phone home screen). Title bars stay at 24 px with close and zoom boxes; long titles truncate with an ellipsis, the timecode at the right stays whole.
- No horizontal page scroll, ever: windows use `grid-template-columns: minmax(0, 1fr)` so a wide title cannot inflate them; wide tables live in a `ScrollArea`, which has `contain: inline-size` so it can never widen its parent, and scrolls inside its well with desktop scrollbars. Verified at 400 px: `scrollWidth === clientWidth`.
- The menu bar folds its items behind a "Menu" button below 700 px; brand, clock and theme stay; anything in the right slot that is not a 24 px item gets `hide-phone`.
- Stat tiles reflow with `repeat(auto-fit, minmax(128px, 1fr))`. The essay sheet keeps 15 px mono at every width. Dialogs keep their double frame and 24 px padding; the dialog file line wraps with `overflow-wrap: anywhere`.
- h1 is `clamp(32px, 9vw, 48px)` on marketing pages.

## 9. What not to do

- No scanlines, no fake CRT curvature, no phosphor glow, no VT323, no flicker.
- No Comic Sans, no Chicago rip-offs, no Press Start 2P, no uppercase-only pixel faces.
- No gratuitous dialogs: an error is a dialog, a 404 is a window, a success is a line of text. Never a "Are you sure?" for something reversible. One default button per dialog.
- No colour on chrome. No colour that is not provenance or the accent. No red.
- No rounded corners, no soft shadows, no gradients other than the two dithers (desk and scrollbar track).
- No animation other than §6. No hover lifts, no skeleton shimmer (use the caret `Loading`).
- No pixel art of people, computers or trash cans. Icons name parts of the product only.
- No fake window chrome on things that are not windows (do not put a title bar on a button group).

## 10. Components (`src/design/desktop/`)

`tokens.css` (variables, `@theme`, base, and the classes every component uses: `.desk .label-plate .inverse .hr-dither .dither .bevel-out .bevel-in .panel .panel-legend .win .win-open .win-title .win-title-text .win-title-right .win-box .win-box-close .win-box-zoom .win-box-spacer .win-body .win-body-chrome .win-grip .win-resizable .win-inactive .menubar .menubar-item .menubar-brand .menubar-right .menubar-items .menubar-toggle .menubar-sheet .hide-phone .btn .btn-primary .btn-quiet .btn-ring .btn-lg .btn-sm .btn-icon .dialog .dialog-head .dialog-title .dialog-actions .dialog-backdrop .chk .radio .choice .field .field-label .progress .progress-fill .progress-typed .progress-paste .progress-ink .scroll .stat .stat-value .stat-detail .chip .chip-* .swatch .range .prov-strip .is-* .desk-icon .transport .marginal .display .essay .link .on-chrome .ruled .caret .prov-paste .prov-paste-edited .prov-unobserved .strike .tabular`) · `fonts.css` · `cx.ts` · `index.ts` (barrel).

| component | file | props |
|---|---|---|
| `Window` | `Window.tsx` | `title, icon?, onClose?, closeLabel?, zoom?, onZoom?, right?, inactive?, as? (section), titleAs? (h2), id?, className?, bodyClassName?, chrome?, resizable?, open?, style?, children` |
| `TitleBar` | `Window.tsx` | `title, icon?, onClose?, closeLabel?, zoom?, onZoom?, right?, inactive?, as?, id?, className?` |
| `MenuBar` | `MenuBar.tsx` | `items: MenuItem[], brand?, brandTo?, right?, linkAs?, label?, className?`; `MenuItem = { label, to?, onSelect?, current?, disabled?, icon? }` |
| `Bevel` | `Bevel.tsx` | `sunken?, as?, className?, style?, id?, children` |
| `Panel` | `Bevel.tsx` | `legend?, as?, className?, style?, id?, children` |
| `Button` | `Button.tsx` | `ButtonHTMLAttributes & { variant?: 'default' \| 'primary' \| 'quiet', size?: 'sm' \| 'md' \| 'lg', ring?, icon? }` (forwardRef) |
| `IconButton` | `Button.tsx` | `icon, label` + button attributes; 24 px square |
| `ButtonLink` | `Button.tsx` | `to, variant?, size?, ring?, icon?, className?, external?, linkAs?, children` |
| `Dialog` | `Dialog.tsx` | `title?, icon?, iconFill?, actions?, onClose?, modal?, role? ('dialog' \| 'alertdialog'), width?, className?, style?, id?, children` |
| `Checkbox`, `Radio` | `Controls.tsx` | `InputHTMLAttributes & { label, description? }` (forwardRef, native input inside a `.choice` label) |
| `TextField` | `Controls.tsx` | `InputHTMLAttributes & { id, label, hint? }` (forwardRef) |
| `ProgressBar` | `ProgressBar.tsx` | `value (0..1), tone? ('accent' \| 'typed' \| 'paste' \| 'ink'), label, segments? (fixed count; fluid when omitted), showValue?, className?, style?` |
| `ScrollArea` | `ScrollArea.tsx` | `maxHeight?, label?, sunken? (true), className?, style?, children` |
| `StatTile` | `Stat.tsx` | `label, value, detail?, tone? ('typed' \| 'paste' \| 'accent'), info?, className?` |
| `Info` | `Stat.tsx` | `text, className?` |
| `Chip` | `Stat.tsx` | `kind? (typed, pasted, paste, pasted-edited, ai, mixed, unobserved, neutral, accent, web, self, internal, search, unknown), className?, children` |
| `Swatch` | `Stat.tsx` | `kind, className?` |
| `DesktopPattern` | `DesktopPattern.tsx` | `plain?, as?, className?, style?, children` |
| `DesktopIcon` | `DesktopPattern.tsx` | `icon, label, to?, onOpen?, linkAs?, size? (32 \| 48), className?` |
| `Icon` | `icons.tsx` | `name: IconName, size? (16 \| 32 \| 48), label?, fill?: Partial<Record<Ink, string>>` + SVG attributes; plus `DocumentIcon, FolderIcon, ClockIcon, LinkIcon, KeyIcon, MagnifierIcon, DiskIcon, WarningIcon, CheckIcon, CrossIcon, MarkIcon, PlayIcon, PauseIcon, BackIcon, ForwardIcon, SunIcon, MoonIcon, GrowIcon`; `PIXELS` (the maps), `pixelPaths`, `ICON_NAMES`, `INK` |

Icons are 16 × 16 pixel maps (strings; `.` none, `#` ink, `w` sheet, `g` chrome-deep, `a` accent, `t` typed, `p` pasted) turned into one crisp-edged SVG path per ink at render time and cached. Render at 16, 32 or 48 to keep pixels whole. `fill={{ w: 'var(--paste)' }}` fills the warning triangle amber. The same maps generate the data-URI glyphs for native checkboxes, radios and scrollbar buttons in `tokens.css` (scratchpad script `gen.mjs`).

`MenuBar`, `ButtonLink` and `DesktopIcon` take `linkAs={Link}` from react-router so the kit itself has no dependency beyond React.

## 11. Adoption: the import swap

In `src/index.css`, change

```css
@import "./design/fonts.css";
@import "tailwindcss";
@import "./design/tokens.css";
@import "./styles/app.css";
```

to

```css
@import "./design/fonts.css";
@import "./design/desktop/fonts.css";
@import "tailwindcss";
@import "./design/desktop/tokens.css";
@import "./styles/app.css";
```

That alone re-themes every page: the palette, the fonts, zero radii, black frames, the desk pattern on `html`, and every `bg-paper text-ink border-rule` utility. Three follow-ups make it the desktop rather than a recoloured manuscript:

1. Remove `bg-paper` from the two layout wrappers (`MarketingLayout`'s root div and the app shell's root) so the dithered desk shows through; or wrap them in `<DesktopPattern>`.
2. Replace `Nav` (marketing) and the `aside` rail in `AppShell` with `<MenuBar items={…} linkAs={Link} right={…} />`, and wrap each `Section`/page block in `<Window title=… right={code}>`. `Section`'s `code` becomes the title bar's `right` slot and `label` its title.
3. Import `Button, ButtonLink, StatTile, Chip, Swatch, Checkbox, Radio, TextField, ScrollArea, Dialog` from `../design/desktop` in `src/components/ui.tsx` in place of the local definitions (same prop names where they existed: `variant` gains `'default'` in place of `'secondary'`/`'ghost'`; `Marginal`, `Sheet`, `Rule`, `Loading`, `Skeleton`, `EmptyState`, `ErrorNote`, `SectionHead`, `Field` keep working on the new tokens, `Sheet` becomes a `Window` when there is time).

Theme toggle, `index.html`'s first-paint script and `localStorage` key are unchanged. `src/design/tokens.css` and the Newsreader files can be deleted once nothing imports them.

## 12. Preview

`web/public/desktop-preview.html` is a static page (inline CSS copied from `tokens.css` by `scratchpad/build-preview.mjs`, inline SVG icons, one ten-line script for the phone menu toggle). It shows Daytime and After Dark one above the other: the menu bar, the replay player window with provenance strip and stat tiles, the declaration window, the verify dialog with its checklist, the broken-chain alert, the Time desk accessory, a Controls window (buttons, choices, fields, progress, chips, scroll area), a type specimen in an inactive window, and the desktop icons. Open it at `/desktop-preview.html` in `vite dev`, or from disk (fonts resolve relatively). Screenshots: `desktop-1280.png` and `desktop-400.png` in the session scratchpad.

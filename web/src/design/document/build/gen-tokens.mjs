// Generates ../tokens.css: the Daylight block, the Night vault block twice (media query and
// explicit attribute) so they cannot drift, the shared/derived block, then tokens.body.css.
// Run from web/:  node src/design/document/build/gen-tokens.mjs
import { writeFileSync, readFileSync } from 'node:fs';
const OUT = new URL('../tokens.css', import.meta.url);
const BODY = readFileSync(new URL('./tokens.body.css', import.meta.url), 'utf8');

const day = `
  /* surfaces: banknote paper, never cream */
  --paper: #e8ede7;
  --paper-deep: #dde4dc; /* alternate bands */
  --sheet: #f6f8f4; /* cards, certificates, the essay */
  --well: #eef2ec; /* fields, sunken lists */
  --frost: rgba(232, 237, 231, 0.74); /* the nav bar, under backdrop blur */
  /* engraving ink */
  --ink: #14213d;
  --ink-soft: #3f4b5e;
  --ink-faint: #5e6a78;
  --on-ink: #f6f8f4;
  /* lines */
  --rule: #c6cfc9; /* hairlines: decorative, never the only edge of a control */
  --rule-strong: #737f79; /* control borders: 3:1 on sheet, paper and well */
  --crop: #5e6a78; /* printer's crop marks */
  /* guilloche */
  --guilloche: #5e8c7a; /* line art only, never text */
  --guilloche-2: #9dbcae; /* the second pass of a rosette */
  --guilloche-ink: #3d6b5a; /* when the guilloche colour must be read as text */
  --guilloche-hero: 0.55; /* canvas opacities */
  --guilloche-card: 0.16;
  --guilloche-faint: 0.08;
  /* seal red: the broken seal and destructive actions, nothing else */
  --seal: #b3261e;
  --seal-fill: #b3261e;
  --on-seal: #ffffff;
  --seal-wash: rgba(179, 38, 30, 0.08);
  /* foil: the verified seal and its hover ONLY */
  --foil-1: #9fe7f5;
  --foil-2: #c9a7f7;
  --foil-3: #f7d79f;
  --foil-ink: #14213d; /* engraving drawn over foil */
  /* provenance */
  --typed: #1d5c47; /* deep guilloche green */
  --paste: #8a4a12; /* engraving sepia */
  --signed: #2546a0; /* ink blue */
  --mixed: #6b5714;
  --unobserved: #5f6873;
  --typed-wash: rgba(29, 92, 71, 0.1);
  --paste-wash: rgba(214, 148, 64, 0.3); /* highlighter over pasted text; ink stays on top */
  --paste-wash-soft: rgba(214, 148, 64, 0.16);
  --signed-wash: rgba(37, 70, 160, 0.08);
  --unobserved-wash: rgba(95, 104, 115, 0.14);
  --on-typed: #ffffff;
  --on-paste: #ffffff;
  --on-signed: #ffffff;
  /* the travelling dots */
  --glow: #239a72;
  --glow-halo: rgba(35, 154, 114, 0.35);
  /* depth */
  --shadow-card: 0 1px 0 rgba(20, 33, 61, 0.04), 0 18px 40px -26px rgba(20, 33, 61, 0.3);
  --shadow-lift: 0 2px 0 rgba(20, 33, 61, 0.05), 0 26px 50px -24px rgba(20, 33, 61, 0.38);
  color-scheme: light;`;

const night = `
  --paper: #0b1020;
  --paper-deep: #080c18;
  --sheet: #121a2e;
  --well: #0e1526;
  --frost: rgba(11, 16, 32, 0.72);
  --ink: #e6ece4;
  --ink-soft: #aeb8c6;
  --ink-faint: #8590a3;
  --on-ink: #0b1020;
  --rule: #253150;
  --rule-strong: #6a7898;
  --crop: #8590a3;
  --guilloche: #6fb39a;
  --guilloche-2: #3c6a5e;
  --guilloche-ink: #7cc2a7;
  --guilloche-hero: 0.6;
  --guilloche-card: 0.2;
  --guilloche-faint: 0.1;
  --seal: #f2766b;
  --seal-fill: #b3261e;
  --on-seal: #ffffff;
  --seal-wash: rgba(242, 118, 107, 0.1);
  --foil-ink: #14213d;
  --typed: #7fd3ae;
  --paste: #e8b46c;
  --signed: #93abff;
  --mixed: #d8c172;
  --unobserved: #9aa4b5;
  --typed-wash: rgba(127, 211, 174, 0.12);
  --paste-wash: rgba(232, 180, 108, 0.28);
  --paste-wash-soft: rgba(232, 180, 108, 0.14);
  --signed-wash: rgba(147, 171, 255, 0.12);
  --unobserved-wash: rgba(154, 164, 181, 0.16);
  --on-typed: #0b1020;
  --on-paste: #0b1020;
  --on-signed: #0b1020;
  --glow: #8ff0c8;
  --glow-halo: rgba(143, 240, 200, 0.4);
  --shadow-card: 0 0 0 1px rgba(255, 255, 255, 0.02), 0 24px 48px -26px rgba(0, 0, 0, 0.7);
  --shadow-lift: 0 0 0 1px rgba(255, 255, 255, 0.03), 0 30px 60px -24px rgba(0, 0, 0, 0.8);
  color-scheme: dark;`;

const css = `/* ---------------------------------------------------------------------------
   Trail design tokens: THE SECURITY DOCUMENT. Owned by design; see
   web/DESIGN-document.md. Engineering imports this in place of
   design/desktop/tokens.css and never edits it: edit build/tokens.body.css or
   build/gen-tokens.mjs and run node src/design/document/build/gen-tokens.mjs.

   Daylight is bare :root. Night vault applies under prefers-color-scheme: dark
   (unless html[data-theme="light"]), under html[data-theme="dark"], and on any
   element with data-surface="night" (data-surface="day" forces Daylight back).
   Every Tailwind colour utility the app already uses keeps its name.
--------------------------------------------------------------------------- */

:root,
[data-surface="day"] {${day}
}

/* Shared and derived values. Declared on every themed element (not only :root) so that
   var() resolves against that element's own palette inside a data-surface island. */
:root,
[data-surface] {
  /* type: plain variables so the kit works with or without Tailwind */
  --doc-display: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --doc-sans: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --doc-mono: "Fragment Mono", ui-monospace, Menlo, Consolas, monospace;
  /* motion (Whistle-derived) */
  --ease-rise: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-rise: 760ms;
  --rise: 20px;
  --stagger: 90ms;
  --dur-press: 180ms;
  /* radii: small, engraved */
  --r-xs: 2px;
  --r-sm: 4px;
  --r-md: 6px;
  --r-pill: 999px;
  /* derived */
  --accent: var(--signed);
  --accent-ink: var(--on-signed);
  --focus: var(--signed);
  /* bridge: names the desktop kit used, mapped onto the document (see §12 of the doc) */
  --chrome: var(--sheet);
  --chrome-deep: var(--well);
  --frame: var(--rule-strong);
  --bevel-hi: transparent;
  --bevel-lo: transparent;
  --desk: var(--paper);
  --margin: var(--guilloche-ink);
  --select: var(--signed);
  --select-ink: var(--on-signed);
  --shadow: var(--shadow-card);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${night}
  }
}

:root[data-theme="dark"],
[data-surface="night"] {${night}
}

${BODY}`;
writeFileSync(OUT, css);
console.log('wrote', OUT.pathname, css.length);

#!/usr/bin/env node
// Renders the toolbar and store icons (icons/icon{16,32,48,128}.png) from the Trail mark in
// web/public/favicon.svg: a cursive l written on a dark tile, and a text caret.
// The 128 px icon follows the Chrome Web Store guidance (96 px artwork, 16 px transparent margin);
// the toolbar sizes fill the square, with a heavier stroke at 16 and 32 px so the pen line survives.
// Run: node tools/icons.mjs   (needs the sharp devDependency: npm install)
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "icons");
mkdirSync(out, { recursive: true });

const mark = (stroke) => `
  <rect width="64" height="64" rx="14" fill="#18181B"/>
  <path d="M17 47c2-12 8-32 14-35 5-2 4 9 0 19-3 8-7 15-3 17 3 1 8-3 12-7" fill="none" stroke="#F2EEE4" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="45" y="27" width="${stroke === 5 ? 3.5 : 5}" height="21" rx="1" fill="#9FB5FF"/>`;

// size: output px; art: artwork px inside it; stroke: pen width in the 64-unit mark
const SIZES = [
  { size: 16, art: 16, stroke: 7 },
  { size: 32, art: 32, stroke: 6 },
  { size: 48, art: 48, stroke: 5.5 },
  { size: 128, art: 96, stroke: 5 },
];
for (const { size, art, stroke } of SIZES) {
  const pad = (size - art) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <g transform="translate(${pad} ${pad}) scale(${art / 64})">${mark(stroke)}</g></svg>`;
  await sharp(Buffer.from(svg), { density: 72 * 4 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(out, `icon${size}.png`));
  console.log(`icons/icon${size}.png`);
}

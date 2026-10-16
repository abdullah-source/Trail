#!/usr/bin/env node
// Builds the Chrome Web Store image kit in extension/store/:
//   screenshots/5-popup.png         1280x800, rendered from src/popup-screen.html
//   promo-small-440x280.png         small promo tile, from src/promo-small.html
//   marquee-1400x560.png            marquee promo tile, from src/marquee.html
// and normalises every PNG in screenshots/ (the browse-tool captures 1-4 included) to exactly
// 1280x800, 24-bit, no alpha channel, as the store requires.
// Run: PLAYWRIGHT=/path/to/playwright-core/index.mjs node store/render.mjs   (from extension/, after npm install)
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright-core");
import sharp from "sharp";
import { readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: "chromium" }) });

async function render(src, out, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(here, "src", src)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
  await page.close();
}
await render("popup-screen.html", join(here, "screenshots", "5-popup.png"), 1280, 800);
await render("promo-small.html", join(here, "promo-small-440x280.png"), 440, 280);
await render("marquee.html", join(here, "marquee-1400x560.png"), 1400, 560);
await browser.close();

// exact size, no alpha (the store rejects transparent PNGs for screenshots and tiles)
async function normalise(file, width, height) {
  const tmp = file + ".tmp.png";
  await sharp(file).resize(width, height, { fit: "cover", position: "top" }).flatten({ background: "#ffffff" }).removeAlpha().png({ compressionLevel: 9 }).toFile(tmp);
  renameSync(tmp, file);
  const m = await sharp(file).metadata();
  console.log(`${file.replace(here + "/", "")}  ${m.width}x${m.height}  channels ${m.channels}`);
}
for (const f of readdirSync(join(here, "screenshots")).filter((f) => f.endsWith(".png")).sort()) await normalise(join(here, "screenshots", f), 1280, 800);
await normalise(join(here, "promo-small-440x280.png"), 440, 280);
await normalise(join(here, "marquee-1400x560.png"), 1400, 560);

// Loads the Trail extension into a real Chromium, serves a fake Canvas assignment page at
// https://x.instructure.com/courses/42/assignments/7, generates mouse and keyboard activity for
// ACTIVE_S seconds (heartbeat shortened with ?trail_fast_ms), hides the tab, then reads the worklog
// store out of the service worker and checks one stint with the right context and a plausible
// active_ms. Then pauses the host and checks that nothing is written.
// Run: PLAYWRIGHT=/path/to/playwright-core/index.mjs [CHROME=/path/to/Chromium] [ACTIVE_S=70] node extension/test/presence-harness.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const EXE = process.env.CHROME || undefined;
const ACTIVE_S = Number(process.env.ACTIVE_S || 70);
const FAST_MS = 5000;
const URL_ = `https://x.instructure.com/courses/42/assignments/7?trail_fast_ms=${FAST_MS}`;

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'trail-presence-')), {
  headless: true,
  // Playwright's own Chromium must be opened through channel 'chromium' for extensions to load headless
  // (Chrome 145 + Playwright 1.58); an explicit CHROME binary is launched as is.
  ...(EXE ? { executablePath: EXE } : { channel: 'chromium' }),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, ...(EXE ? ['--headless=new'] : [])],
});

await ctx.route('https://x.instructure.com/**', (route) => route.fulfill({
  status: 200, contentType: 'text/html',
  body: `<html><head><title>Essay 2: Cities and silence</title></head><body>
    <div id="breadcrumbs"><ul>
      <li><a href="/"><span class="ellipsible">My Dashboard</span></a></li>
      <li><a href="/courses/42"><span class="ellipsible">ENG 101</span></a></li>
      <li><a href="/courses/42/assignments"><span class="ellipsible">Assignments</span></a></li>
      <li><span class="ellipsible">Essay 2: Cities and silence</span></li>
    </ul></div>
    <h1 class="title">Essay 2: Cities and silence</h1>
    <p>The assignment text. No editor on this page, so only presence runs (the recorder finds nothing to attach to).</p>
    <div style="height:3000px">long page</div>
  </body></html>`,
}));

const readWorklog = (sw) => sw.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('trail'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (store) => new Promise((res, rej) => { const t = db.transaction(store).objectStore(store).getAll(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  const out = { version: db.version, worklog: await all('worklog'), docs: await all('docs'), sessions: await all('sessions') };
  db.close();
  return out;
});

async function workFor(page, seconds) {
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < seconds * 1000) {
    await page.mouse.move(100 + (i % 50) * 5, 100 + (i % 30) * 4);
    if (i % 3 === 0) await page.keyboard.type('a');
    if (i % 7 === 0) await page.mouse.wheel(0, 40);
    await page.waitForTimeout(500);
    i++;
  }
}

let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; };

// ---- 1. an active stint on a Canvas assignment ---------------------------------------------------
const page = await ctx.newPage();
await page.goto(URL_);
await page.waitForTimeout(1200);
const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
await page.locator('p').click();   // focus the page without hitting a breadcrumb link
console.log(`working for ${ACTIVE_S}s …`);
await workFor(page, ACTIVE_S);
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));  // flush
await page.waitForTimeout(1500);

let r = await readWorklog(sw);
check(r.version === 3, `IndexedDB version is 3 (got ${r.version})`);
check(r.worklog.length === 1, `one worklog row (got ${r.worklog.length})`);
const row = r.worklog[0] || {};
console.log('row:', JSON.stringify(row));
check(row.course_key === 'canvas:x.instructure.com:42', `course_key ${row.course_key}`);
check(row.kind === 'assignment', `kind ${row.kind}`);
check(row.item_key === 'canvas:x.instructure.com:42:assignment:7', `item_key ${row.item_key}`);
check(row.course_label === 'ENG 101', `course_label ${row.course_label}`);
check(row.item_label === 'Essay 2: Cities and silence', `item_label ${row.item_label}`);
check(row.editor === 'canvas' && row.host === 'x.instructure.com', `editor/host ${row.editor}/${row.host}`);
check(row.doc === null, `doc is null for an LMS page (got ${row.doc})`);
check(row.active_ms >= (ACTIVE_S - 12) * 1000 && row.active_ms <= (ACTIVE_S + 5) * 1000, `active_ms ${row.active_ms} within [${(ACTIVE_S - 12) * 1000}, ${(ACTIVE_S + 5) * 1000}]`);
check(row.heartbeats >= Math.floor((ACTIVE_S * 1000) / FAST_MS) - 2, `heartbeats ${row.heartbeats}`);
check(/^\d{4}-\d{2}-\d{2}$/.test(row.day), `day ${row.day}`);
check(Date.parse(row.end) - Date.parse(row.start) >= row.active_ms - 2000, `start..end (${Date.parse(row.end) - Date.parse(row.start)} ms) covers active_ms`);
check(r.docs.length === 0 && r.sessions.length === 0, `no doc or recorder session was minted by presence alone (docs ${r.docs.length}, sessions ${r.sessions.length})`);

// bridge-shaped answers, called inside the worker like the web app would
const summary = await sw.evaluate(() => globalThis.__trailTest.worklogSummary(null, null));
check(summary.total_ms === row.active_ms, `summary.total_ms ${summary.total_ms}`);
check(summary.by_course.length === 1 && summary.by_course[0].items === 1 && summary.by_course[0].course_label === 'ENG 101', `by_course ${JSON.stringify(summary.by_course)}`);
check(summary.by_item.length === 1 && summary.by_item[0].stints === 1 && summary.by_item[0].kind === 'assignment', `by_item ${JSON.stringify(summary.by_item)}`);
check(summary.by_day.length === 1 && summary.by_day[0].active_ms === row.active_ms, `by_day ${JSON.stringify(summary.by_day)}`);
check(summary.by_hour.length === 24 && Math.abs(summary.by_hour.reduce((a, b) => a + b, 0) - row.active_ms) <= 24, `by_hour sums to ${summary.by_hour.reduce((a, b) => a + b, 0)}`);
await page.close();
await new Promise((r) => setTimeout(r, 1500));   // let the close-time flush land before the store is cleared

// ---- 2. paused host: nothing is written ------------------------------------------------------------
await sw.evaluate(async () => {
  await chrome.storage.local.set({ paused: ['x.instructure.com'] });
  await globalThis.__trailTest.clearWorklog();
});
const page2 = await ctx.newPage();
await page2.goto(URL_);
await page2.waitForTimeout(800);
await page2.locator('p').click();
console.log('paused: working for 12s …');
await workFor(page2, 12);
await page2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page2.waitForTimeout(1200);
r = await readWorklog(sw);
check(r.worklog.length === 0, `no worklog rows while x.instructure.com is paused (got ${r.worklog.length})`);
await page2.close();

await ctx.close();
console.log(failures ? `${failures} check(s) FAILED` : 'PASS');
process.exit(failures ? 1 : 0);

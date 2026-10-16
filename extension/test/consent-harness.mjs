// Loads the Trail extension into a real Chromium WITHOUT recording consent and checks that nothing
// is recorded: typing and pasting in a fake docs.google.com page, active time on a fake Canvas page,
// and switching to a fake chatgpt.com tab leave the local database empty, and no checkpoint is sent.
// Then consent is granted (as the popup and the welcome page do) and it checks the default paste
// attribution without the optional all-sites permission: copytrack.js is not registered for other
// sites, a copy on a fake en.wikipedia.org page is not seen, and pasting that text into the document
// is recorded with source_kind "unknown"; a copy inside the document itself is still "self".
// Finally consent is withdrawn and it checks that recording stops at once.
// Run: PLAYWRIGHT=/path/to/playwright-core/index.mjs [CHROME=/path/to/Chromium] node extension/test/consent-harness.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const EXE = process.env.CHROME || undefined;
const DOC = 'https://docs.google.com/document/d/FAKEDOC789/edit';
const LMS = 'https://x.instructure.com/courses/42/assignments/7?trail_fast_ms=2000';
let exportText = 'Existing first line.\r\n';

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'trail-consent-')), {
  headless: true,
  ...(EXE ? { executablePath: EXE } : { channel: 'chromium' }),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, ...(EXE ? ['--headless=new'] : [])],
});
await ctx.route('https://docs.google.com/**', (route) => {
  const url = route.request().url();
  if (url.includes('/export?format=txt')) return route.fulfill({ status: 200, contentType: 'text/plain', body: '﻿' + exportText });
  return route.fulfill({
    status: 200, contentType: 'text/html',
    body: `<html><head><title>Consent check - Google Docs</title></head><body>
      <p id="own">a sentence already in this document</p>
      <iframe class="docs-texteventtarget-iframe" src="about:blank"></iframe>
      <script>
        const f = document.querySelector('.docs-texteventtarget-iframe');
        f.contentDocument.body.contentEditable = 'true';
        f.contentDocument.body.id = 'tgt';
        f.contentDocument.addEventListener('keydown', (e) => e.preventDefault());
        f.contentDocument.addEventListener('beforeinput', (e) => e.preventDefault());
        window.fakePaste = (t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); f.contentDocument.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); };
        window.copyOwn = () => { getSelection().selectAllChildren(document.getElementById('own')); document.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true })); };
        f.contentDocument.body.focus();
      </script></body></html>`,
  });
});
await ctx.route('https://x.instructure.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: `<html><head><title>Essay 2</title></head><body>
  <div id="breadcrumbs"><ul><li><a href="/">Dashboard</a></li><li><a href="/courses/42">ENG 101</a></li><li><span>Essay 2</span></li></ul></div>
  <h1 class="title">Essay 2</h1><p>assignment text</p></body></html>` }));
const simplePage = (title) => (route) => route.fulfill({ status: 200, contentType: 'text/html', body: `<html><head><title>${title}</title></head><body><p id="t">Copied from an encyclopedia page.</p>
  <script>window.copyIt = () => { getSelection().selectAllChildren(document.getElementById('t')); document.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true })); };</script></body></html>` });
await ctx.route('https://chatgpt.com/**', simplePage('ChatGPT (fake)'));
await ctx.route('https://en.wikipedia.org/**', simplePage('Wikipedia (fake)'));

let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; };
const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
const readDb = () => sw.evaluate(async () => {
  // before consent the extension never opens its database; opening it here would create an empty one
  if (!(await indexedDB.databases()).some((d) => d.name === 'trail')) return { none: true, events: [], docs: [], sessions: [], worklog: [], snapshots: [] };
  const db = await new Promise((res, rej) => { const r = indexedDB.open('trail'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (store) => new Promise((res, rej) => { const t = db.transaction(store).objectStore(store).getAll(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  const out = { events: await all('events'), docs: await all('docs'), sessions: await all('sessions'), worklog: await all('worklog'), snapshots: await all('snapshots') };
  db.close();
  return out;
});

// ---- 1. no consent: nothing is recorded ---------------------------------------------------------------
check((await sw.evaluate(() => globalThis.__trailTest.consentState())).granted === false, 'a fresh install has no consent');
const page = await ctx.newPage();
await page.goto(DOC);
await page.waitForTimeout(1500);
const frame = page.frames().find((f) => f !== page.mainFrame());
await frame.locator('#tgt').focus();
const type = async (s) => { for (const ch of s) { await frame.locator('#tgt').press(ch === ' ' ? 'Space' : ch); await page.waitForTimeout(50); } };
await type('typed before consent');
await page.evaluate(() => window.fakePaste(' pasted before consent'));
await page.waitForTimeout(1700);
const ai = await ctx.newPage();
await ai.goto('https://chatgpt.com/');
await ai.bringToFront();
await ai.waitForTimeout(6000);
await page.bringToFront();
const lms = await ctx.newPage();
await lms.goto(LMS);
await lms.bringToFront();
await lms.locator('p').click();
for (let i = 0; i < 12; i++) { await lms.mouse.move(100 + i * 7, 120 + i * 3); await lms.waitForTimeout(500); }
await lms.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.bringToFront();
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(1500);
let r = await readDb();
console.log(r.none ? 'no local database exists yet' : 'local database exists');
check(r.events.length === 0 && r.sessions.length === 0 && r.docs.length === 0, `no events, sessions or documents before consent (events ${r.events.length}, sessions ${r.sessions.length}, docs ${r.docs.length})`);
check(r.worklog.length === 0, `no homework time before consent (rows ${r.worklog.length})`);
check(r.snapshots.length === 0, `no text snapshots before consent (${r.snapshots.length})`);
const front = await sw.evaluate(() => globalThis.__trailTest.front());
check(front === null, `no tab is tracked before consent (front ${JSON.stringify(front)})`);
// even when signed in, the 10-minute checkpoint does nothing without consent
const cpRes = await sw.evaluate(async () => {
  await chrome.storage.local.set({ token: 't', server: 'https://example.invalid' });
  const out = await globalThis.__trailTest.checkpointAll();
  await chrome.storage.local.remove(['token', 'server']);
  return out;
});
check(cpRes && cpRes.skipped === 'no consent', `no checkpoint is sent before consent (${JSON.stringify(cpRes)})`);

// ---- 2. consent given; optional all-sites permission not granted -----------------------------------------
const granted = await sw.evaluate(() => globalThis.__trailTest.setConsent(true));
check(granted.granted === true && granted.v === 1 && !!granted.at, `consent stored as {v:1, at} (${JSON.stringify(granted)})`);
const perm = await sw.evaluate(() => chrome.permissions.contains({ origins: ['https://*/*', 'http://*/*'] }));
check(perm === false, 'the all-sites permission is not granted by default');
const sync = await sw.evaluate(() => globalThis.__trailTest.syncCopytrack());
const regs = await sw.evaluate(() => globalThis.__trailTest.registered());
check(sync.granted === false && regs.length === 0, `copytrack.js is not registered for other sites without it (${JSON.stringify(regs)})`);

const wiki = await ctx.newPage();
await wiki.goto('https://en.wikipedia.org/wiki/Silence');
await wiki.bringToFront();
await wiki.evaluate(() => window.copyIt());
await wiki.waitForTimeout(800);
const lastAfterWiki = await sw.evaluate(() => globalThis.__trailTest.lastCopy());
check(lastAfterWiki === null, `a copy on en.wikipedia.org is not seen without the permission (${JSON.stringify(lastAfterWiki)})`);
await page.bringToFront();
await frame.locator('#tgt').focus();
await type('after');
await page.evaluate(() => window.fakePaste('Copied from an encyclopedia page.'));
await page.waitForTimeout(1500);
await page.evaluate(() => window.copyOwn());
await page.waitForTimeout(800);
const lastOwn = await sw.evaluate(() => globalThis.__trailTest.lastCopy());
check(!!lastOwn && lastOwn.host === 'docs.google.com', `a copy inside the document is still seen on a supported site (${JSON.stringify(lastOwn && lastOwn.host)})`);
await page.evaluate(() => window.fakePaste('a sentence already in this document'));
await page.waitForTimeout(1500);
r = await readDb();
const pastes = r.events.filter((e) => e.kind === 'paste');
check(r.sessions.length === 1 && r.events.some((e) => e.kind === 'insert'), `recording starts once consent is given (sessions ${r.sessions.length}, events ${r.events.length})`);
check(pastes.length === 2, `two pastes recorded after consent (got ${pastes.length})`);
check(pastes[0] && pastes[0].data.source_kind === 'unknown' && pastes[0].data.source_host === null, `paste copied from another site is "unknown" without the permission (${JSON.stringify(pastes[0] && { k: pastes[0].data.source_kind, h: pastes[0].data.source_host })})`);
check(pastes[1] && pastes[1].data.source_kind === 'self' && pastes[1].data.from_self === true, `paste copied inside the same document is "self" (${JSON.stringify(pastes[1] && pastes[1].data.source_kind)})`);
check(!r.events.some((e) => JSON.stringify(e.data).includes('before consent')), 'nothing typed or pasted before consent made it into the record');

// The register/unregister logic itself, with Chrome's answer about the permission stubbed (a headless
// test cannot click Chrome's permission prompt): granted -> registered on every site except the
// supported ones (which already run it); revoked -> unregistered.
const reg = await sw.evaluate(async () => {
  const real = chrome.permissions.contains;
  const out = {};
  try {
    chrome.permissions.contains = async () => true;
    out.on = await globalThis.__trailTest.syncCopytrack();
    out.onRegs = await chrome.scripting.getRegisteredContentScripts();
    chrome.permissions.contains = async () => false;
    out.off = await globalThis.__trailTest.syncCopytrack();
    out.offRegs = await chrome.scripting.getRegisteredContentScripts();
  } catch (e) { out.error = String(e); } finally { chrome.permissions.contains = real; }
  return out;
});
const one = reg.onRegs && reg.onRegs[0];
check(!reg.error && reg.on.granted && reg.onRegs.length === 1 && one.id === 'trail-copytrack' && one.js[0] === 'src/copytrack.js' && one.matches.includes('https://*/*') && one.excludeMatches.includes('https://docs.google.com/document/*') && one.runAt === 'document_start' && one.allFrames, `with the permission, copytrack.js is registered for all sites (${reg.error || JSON.stringify(one)})`);
check(!reg.error && reg.off.granted === false && reg.offRegs.length === 0, 'when the permission is removed, it is unregistered');

// ---- 3. consent withdrawn: recording stops at once -----------------------------------------------------
await sw.evaluate(() => globalThis.__trailTest.setConsent(false));
const before = (await readDb()).events.length;
await frame.locator('#tgt').focus();
await type('typed after withdrawing');
await page.evaluate(() => window.fakePaste(' pasted after withdrawing'));
await ai.bringToFront();
await ai.waitForTimeout(5500);
await page.bringToFront();
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(1500);
r = await readDb();
const ended = r.sessions.every((s) => s.ended);
const last = r.events.sort((a, b) => a.seq - b.seq).at(-1);
check(ended && last && last.kind === 'session.end' && last.data.reason === 'stopped', `withdrawing closes the session (${last && last.kind} ${last && JSON.stringify(last.data)})`);
check(r.events.length === before, `no event after consent is withdrawn (${before} -> ${r.events.length})`);
check((await sw.evaluate(() => globalThis.__trailTest.consentState())).granted === false, 'consent is gone from storage');

await ctx.close();
console.log(failures ? `${failures} check(s) FAILED` : 'PASS');
process.exit(failures ? 1 : 0);

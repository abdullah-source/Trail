// Loads the Trail extension into a real Chromium and drives a fake docs.google.com page
// (the real Docs needs a Google login). The fake page has the hidden text-event iframe
// Docs uses, and the export URL is served from a mutable string that the test edits to
// mimic what Docs would say after each action. Then it reads the recorded events out of
// the extension's IndexedDB and replays them with the same rules the app uses.
// Run: PLAYWRIGHT=/path/to/playwright-core/index.mjs CHROME=/path/to/Chromium node extension/test/docs-harness.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const EXE = process.env.CHROME || undefined;  // unset: Playwright's own Chromium
const DOC = 'https://docs.google.com/document/d/FAKEDOC123/edit';
let exportText = 'Existing first line.\r\n';

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'trail-')), {
  headless: true,
  executablePath: EXE,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'],
});
await ctx.route('https://docs.google.com/**', (route) => {
  const url = route.request().url();
  if (url.includes('/export?format=txt')) return route.fulfill({ status: 200, contentType: 'text/plain', body: '﻿' + exportText });
  return route.fulfill({
    status: 200, contentType: 'text/html',
    body: `<html><head><title>Cities and silence - Google Docs</title></head><body>
      <div class="kix-appview-editor" style="width:600px;height:400px;background:#eee">canvas stands here</div>
      <iframe class="docs-texteventtarget-iframe" src="about:blank"></iframe>
      <script>
        const f = document.querySelector('.docs-texteventtarget-iframe');
        f.contentDocument.body.contentEditable = 'true';
        f.contentDocument.body.id = 'tgt';
        window.setSelection = (t) => { f.contentDocument.body.innerText = t; };
        // Like Docs: keys never change the iframe; the editor handles them itself.
        f.contentDocument.addEventListener('keydown', (e) => e.preventDefault());
        f.contentDocument.addEventListener('beforeinput', (e) => e.preventDefault());
        window.fakePaste = (t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); f.contentDocument.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); };
        f.contentDocument.body.focus();
      </script></body></html>`,
  });
});
const page = await ctx.newPage();
await page.goto(DOC);
await page.waitForTimeout(1500); // recorder attaches every 3 s; first attach is immediate
let sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
const frame = page.frames().find((f) => f !== page.mainFrame());
await frame.locator('#tgt').focus();

const type = async (s, delay = 60) => { for (const ch of s) { await frame.locator('#tgt').press(ch === '\n' ? 'Enter' : ch === ' ' ? 'Space' : ch); await page.waitForTimeout(delay); } };
const setDoc = (t) => { exportText = t.replace(/\n/g, '\r\n') + '\r\n'; };

// 1. type at the end
await type('Hello world');            setDoc('Existing first line.\nHello world');
await page.waitForTimeout(1700);
// 2. plain backspaces (observable)
for (let i = 0; i < 5; i++) { await frame.locator('#tgt').press('Backspace'); await page.waitForTimeout(80); }
setDoc('Existing first line.\nHello ');
await page.waitForTimeout(1700);
// 3. option+backspace deletes a whole word (unobservable; export must fix it)
await frame.locator('#tgt').press('Alt+Backspace'); setDoc('Existing first line.\n');
await page.waitForTimeout(6000);
// 4. type, then select a word (docs mirrors selection into the iframe) and press a key to replace it
await type('Quick brown fox'); setDoc('Existing first line.\nQuick brown fox');
await page.waitForTimeout(1700);
await page.evaluate(() => window.setSelection('brown fox'));
await frame.locator('#tgt').press('Backspace'); setDoc('Existing first line.\nQuick ');
await page.evaluate(() => window.setSelection(''));
await page.waitForTimeout(6000);
// 5. undo (cmd+z) brings it back (unobservable)
await frame.locator('#tgt').press('Meta+z'); setDoc('Existing first line.\nQuick brown fox');
await page.waitForTimeout(6000);
// 6. paste a sentence from elsewhere
await page.evaluate(() => window.fakePaste(' and a pasted sentence.')); setDoc('Existing first line.\nQuick brown fox and a pasted sentence.');
await page.waitForTimeout(6000);
// flush: blur + hidden
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(2500);

const events = await sw.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('trail'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (store) => new Promise((res, rej) => { const t = db.transaction(store).objectStore(store).getAll(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  return { events: await all('events'), sessions: await all('sessions'), docs: await all('docs') };
});
await ctx.close();

const evs = events.events.sort((a, b) => a.seq - b.seq);
console.log('sessions:', events.sessions.length, 'events:', evs.length, 'docs:', events.docs.map((d) => d.id));
for (const e of evs) {
  const d = e.data || {};
  const brief = e.kind === 'insert' ? JSON.stringify(d.text) : e.kind === 'delete' ? `len=${d.len}` : e.kind === 'resync' ? JSON.stringify(d.text) : e.kind === 'paste' ? JSON.stringify(d.text) : e.kind === 'snapshot' ? `chars=${d.chars}` : '';
  console.log(String(e.seq).padStart(3), e.kind.padEnd(14), brief);
}
// replay with the Docs rules (pos<0 = end)
let text = '';
for (const e of evs) {
  const d = e.data || {};
  if (e.kind === 'insert' || e.kind === 'paste') text += d.text;
  else if (e.kind === 'delete') text = text.slice(0, Math.max(0, text.length - d.len));
  else if (e.kind === 'resync') text = d.text;
}
console.log('FINAL REPLAY TEXT:', JSON.stringify(text));
const EXP = 'Existing first line.\nQuick brown fox and a pasted sentence.';
console.log('EXPECTED        :', JSON.stringify(EXP));
console.log(text === EXP ? 'PASS' : 'FAIL');

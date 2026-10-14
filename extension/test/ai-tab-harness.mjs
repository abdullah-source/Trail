// Loads the Trail extension into a real Chromium, drives the same fake docs.google.com page as
// docs-harness.mjs, then opens a second tab at a fake https://chatgpt.com, keeps it in front for a
// few seconds, comes back to the document and types. A third leg navigates the other tab in place
// (chatgpt.com -> en.wikipedia.org) to cover URL changes in the front tab. Then it reads the recorded
// events out of the extension's IndexedDB and checks:
//   * source.visit for chatgpt.com carries ai:true and a plausible dwell; en.wikipedia.org carries no flag
//   * every source.visit holds a host and a dwell only (never a URL or a title)
//   * the return to the document is a focus event {state:"focus", from_host:"chatgpt.com", from_ai:true},
//     and typing follows it within a minute; the return from Wikipedia says from_ai:false
//   * the recorder's own visibility events (hidden / visible) are in the record
// Headless Chromium never fires visibilitychange when another tab comes to the front, so the recorder's
// hidden/visible events are driven by hand: `document.hidden` is overridden inside the extension's own
// isolated world (where the content script reads it) and the event dispatched there. HEADED=1 runs a
// visible browser instead, where the real visibility change does it.
// Run: PLAYWRIGHT=/path/to/playwright-core/index.mjs [CHROME=/path/to/Chromium] [HEADED=1] node extension/test/ai-tab-harness.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const EXE = process.env.CHROME || undefined;  // unset: Playwright's own Chromium
const DOC = 'https://docs.google.com/document/d/FAKEDOC456/edit';
const AI_DWELL_S = Number(process.env.AI_DWELL_S || 6.5);
const HEADED = !!process.env.HEADED;
let exportText = 'Existing first line.\r\n';

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'trail-ai-')), {
  headless: !HEADED,
  // Playwright's own Chromium must be opened through channel 'chromium' for extensions to load headless
  // (Chrome 145 + Playwright 1.58); an explicit CHROME binary is launched as is.
  ...(EXE ? { executablePath: EXE } : { channel: 'chromium' }),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, ...(EXE ? ['--headless=new'] : [])],
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
        f.contentDocument.addEventListener('keydown', (e) => e.preventDefault());
        f.contentDocument.addEventListener('beforeinput', (e) => e.preventDefault());
        f.contentDocument.body.focus();
      </script></body></html>`,
  });
});
const simplePage = (title) => (route) => route.fulfill({ status: 200, contentType: 'text/html', body: `<html><head><title>${title}</title></head><body><h1>${title}</h1><p>Nothing here is read by Trail.</p></body></html>` });
await ctx.route('https://chatgpt.com/**', simplePage('ChatGPT (fake)'));
await ctx.route('https://en.wikipedia.org/**', simplePage('Wikipedia (fake)'));

let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; };

// ---- 1. the document tab: type so a session opens ---------------------------------------------------
const page = await ctx.newPage();
await page.goto(DOC);
await page.waitForTimeout(1500);
const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
const frame = page.frames().find((f) => f !== page.mainFrame());
await frame.locator('#tgt').focus();
const type = async (s, delay = 60) => { for (const ch of s) { await frame.locator('#tgt').press(ch === ' ' ? 'Space' : ch); await page.waitForTimeout(delay); } };
const setDoc = (t) => { exportText = t.replace(/\n/g, '\r\n') + '\r\n'; };
await type('Hello world'); setDoc('Existing first line.\nHello world');
await page.waitForTimeout(1700);

// ---- 2. an AI tab in front for a few seconds, then back to the document and typing ------------------
const tStartAi = Date.now();
const ai = await ctx.newPage();
await ai.goto('https://chatgpt.com/');
await ai.bringToFront();
console.log(`chatgpt.com in front for ${AI_DWELL_S}s …`);
await ai.waitForTimeout(AI_DWELL_S * 1000);
const tReturn = Date.now();
await page.bringToFront();
await frame.locator('#tgt').focus();
await page.waitForTimeout(800);
await type('back again'); setDoc('Existing first line.\nHello worldback again');
await page.waitForTimeout(5500);   // long enough for the document tab's own dwell to count

// ---- 3. the other tab navigates in place: chatgpt.com -> en.wikipedia.org, then back to the doc -----
await ai.bringToFront();
await ai.waitForTimeout(5500);
await ai.goto('https://en.wikipedia.org/wiki/Silence');
await ai.waitForTimeout(5500);
await page.bringToFront();
await frame.locator('#tgt').focus();
await page.waitForTimeout(800);
await type('more'); setDoc('Existing first line.\nHello worldback againmore');
await page.waitForTimeout(1700);

// ---- 4. leaving and returning as the recorder sees it: visibilitychange hidden, then visible ---------
// (flushes the pending batch and takes a snapshot on hidden)
async function setHidden(hidden) {
  if (HEADED) { await (hidden ? ai : page).bringToFront(); return; }
  const cdp = await ctx.newCDPSession(page);
  const contexts = [];
  cdp.on('Runtime.executionContextCreated', (e) => contexts.push(e.context));
  await cdp.send('Runtime.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const world = contexts.find((c) => c.origin && c.origin.startsWith('chrome-extension://') && c.auxData && c.auxData.frameId === frameTree.frame.id);
  if (!world) throw new Error('no content-script world found on the document page');
  await cdp.send('Runtime.evaluate', {
    contextId: world.id,
    expression: `Object.defineProperty(document, 'hidden', { configurable: true, get: () => ${hidden} });
                 Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => ${hidden ? "'hidden'" : "'visible'"} });
                 document.dispatchEvent(new Event('visibilitychange')); 'ok'`,
  });
  await cdp.detach();
}
await page.bringToFront();
await setHidden(true);
await page.waitForTimeout(1500);
await setHidden(false);
await page.waitForTimeout(2000);

const probe = await sw.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('trail'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (store) => new Promise((res, rej) => { const t = db.transaction(store).objectStore(store).getAll(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  const out = { events: await all('events'), sessions: await all('sessions'), docs: await all('docs') };
  db.close();
  const T = globalThis.__trailTest;
  out.classify = { hf: T.isAiUrl('https://huggingface.co/chat/conversation/1'), hfHome: T.isAiUrl('https://huggingface.co/models'), www: T.isAiUrl('https://www.chatgpt.com/c/1'), wiki: T.isAiUrl('https://en.wikipedia.org/wiki/X'), pasteHf: T.classify('huggingface.co', false) };
  return out;
});
await ctx.close();

const evs = probe.events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq));
console.log('sessions:', probe.sessions.length, 'events:', evs.length, 'docs:', probe.docs.map((d) => d.id));
for (const e of evs) {
  const d = e.data || {};
  const brief = e.kind === 'insert' ? JSON.stringify(d.text) : e.kind === 'source.visit' ? `${d.host} ${d.dwell_ms}ms${d.ai ? ' ai' : ''}` : e.kind === 'focus' ? JSON.stringify(d) : e.kind === 'snapshot' ? `chars=${d.chars}` : '';
  console.log(String(e.seq).padStart(3), e.ts.slice(11, 23), e.kind.padEnd(14), brief);
}

check(probe.sessions.length === 1, `one recorder session (got ${probe.sessions.length})`);
const visits = evs.filter((e) => e.kind === 'source.visit');
const aiVisits = visits.filter((v) => v.data.host === 'chatgpt.com');
check(aiVisits.length >= 2, `chatgpt.com was recorded as a source visit twice (got ${aiVisits.length})`);
check(aiVisits.every((v) => v.data.ai === true), 'every chatgpt.com visit carries ai:true');
check(aiVisits.length > 0 && aiVisits[0].data.dwell_ms >= (AI_DWELL_S - 1.5) * 1000 && aiVisits[0].data.dwell_ms <= (AI_DWELL_S + 3) * 1000, `first chatgpt.com dwell ${aiVisits[0] && aiVisits[0].data.dwell_ms} ms is about ${AI_DWELL_S}s`);
const wiki = visits.filter((v) => v.data.host === 'en.wikipedia.org');
check(wiki.length === 1 && !('ai' in wiki[0].data) && wiki[0].data.dwell_ms >= 4000, `en.wikipedia.org visit recorded from the in-tab navigation, without an ai flag (${JSON.stringify(wiki.map((w) => w.data))})`);
check(visits.some((v) => v.data.host === 'docs.google.com'), 'the document tab\'s own dwell is recorded too');
check(visits.every((v) => Object.keys(v.data).every((k) => ['host', 'dwell_ms', 'ai'].includes(k))), 'source visits hold host, dwell and the ai flag only (no URL, no title)');
check(!JSON.stringify(evs).includes('/wiki/') && !JSON.stringify(evs).includes('Wikipedia (fake)'), 'no path or page title anywhere in the record');

const returns = evs.filter((e) => e.kind === 'focus' && 'from_host' in e.data);
check(returns.length === 2, `two returns to the document were recorded (got ${returns.length})`);
const [r1, r2] = returns;
check(r1 && r1.data.state === 'focus' && r1.data.from_host === 'chatgpt.com' && r1.data.from_ai === true, `first return is from chatgpt.com with from_ai:true (${JSON.stringify(r1 && r1.data)})`);
check(r2 && r2.data.from_host === 'en.wikipedia.org' && r2.data.from_ai === false, `second return is from en.wikipedia.org with from_ai:false (${JSON.stringify(r2 && r2.data)})`);
if (r1) {
  const tr = Date.parse(r1.ts);
  check(Math.abs(tr - tReturn) < 3000, `return was stamped when the tab came to the front (${tr - tReturn} ms off)`);
  const after = evs.filter((e) => e.kind === 'insert' && Date.parse(e.ts) >= tr && Date.parse(e.ts) <= tr + 60_000);
  check(after.length >= 1 && after.map((e) => e.data.text).join('').includes('back again'), `typing within a minute of the return (${JSON.stringify(after.map((e) => e.data.text))})`);
  const visitBefore = aiVisits[0] && (aiVisits[0].ts < r1.ts || (aiVisits[0].ts === r1.ts && aiVisits[0].seq < r1.seq));
  check(visitBefore, 'the AI tab\'s dwell is recorded just before the return');
  check(Date.parse(aiVisits[0].ts) - tStartAi >= 0, 'dwell and return are in order');
}
const vis = evs.filter((e) => e.kind === 'focus' && (e.data.state === 'hidden' || e.data.state === 'visible'));
check(vis.some((e) => e.data.state === 'hidden') && vis.some((e) => e.data.state === 'visible'), `recorder visibility events present (${vis.map((e) => e.data.state).join(', ')})`);
const hiddenEv = vis.find((e) => e.data.state === 'hidden');
const moreInsert = evs.find((e) => e.kind === 'insert' && e.data.text === 'more');
check(!!moreInsert && !!hiddenEv && (moreInsert.ts < hiddenEv.ts || (moreInsert.ts === hiddenEv.ts && moreInsert.seq < hiddenEv.seq)), 'going hidden flushed the pending typing batch before the hidden event');
check(vis.every((e) => Object.keys(e.data).join() === 'state'), 'visibility events carry the state only');
check(probe.classify.hf === true && probe.classify.hfHome === false, `huggingface.co/chat is an AI page, huggingface.co/models is not (${JSON.stringify(probe.classify)})`);
check(probe.classify.www === true && probe.classify.wiki === false, 'subdomains of AI hosts match, other sites do not');
check(probe.classify.pasteHf === 'web', 'a paste from huggingface.co (host only) stays "web": the path is never recorded');

// OUT=/path/events.json keeps the record so it can be run through the analysis (python -m trail.cli analyse ...).
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(evs));
console.log(failures ? `${failures} check(s) FAILED` : 'PASS');
process.exit(failures ? 1 : 0);

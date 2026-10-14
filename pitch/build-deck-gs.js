// Builds Trail-Pitch-GoogleSlides.pptx (16:9) for Google Slides import. Run: node build-deck.js
const pptxgen = require('pptxgenjs');

const HEX = { dk1: 'F2EEE4', lt1: '0E0D0C', dk2: 'C9C3B6', lt2: '161513', accent1: '6B8CFF', accent2: '5FCB84', accent3: 'E0A64B', accent5: '8B867C' };
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625
pres.title = 'Trail Pitch Deck';
pres.author = 'Abdullah Ali';

const W = 10, H = 5.625, M = 0.5;

// ---------- layouts

// ---------- helpers (fresh option objects every call)
const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 13, fontFace: 'Arial', color: 'C9C3B6', valign: 'top' }, o));
const card = (s, x, y, w, h, name) => s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: '161513' }, line: { color: '2B2823', width: 0.75 }, objectName: name });
const label = (s, t, x, y, w, color) => txt(s, t.toUpperCase(), { x, y, w, h: 0.25, fontSize: 9, color: color || '8B867C', charSpacing: 2, bold: true });
const stat = (s, x, y, w, k, v, d, vColor) => {
  label(s, k, x, y, w);
  txt(s, v, { x, y: y + 0.28, w, h: 0.75, fontSize: 40, fontFace: 'Georgia', color: vColor || 'F2EEE4' });
  txt(s, d, { x, y: y + 1.08, w, h: 0.8, fontSize: 11.5, color: 'C9C3B6' });
};
const cardText = (s, x, y, w, h, eyebrow, head, body, name) => {
  card(s, x, y, w, h, name);
  label(s, eyebrow, x + 0.22, y + 0.2, w - 0.44);
  txt(s, head, { x: x + 0.22, y: y + 0.48, w: w - 0.44, h: 0.55, fontSize: 15, fontFace: 'Georgia', color: 'F2EEE4' });
  txt(s, body, { x: x + 0.22, y: y + 1.0, w: w - 0.44, h: h - 1.15, fontSize: 11, color: 'C9C3B6' });
};
const bullets = (s, items, x, y, w, h, size) => s.addText(items.map((t, i) => ({ text: t, options: { bullet: { code: '2014' }, breakLine: i < items.length - 1, paraSpaceAfter: 6 } })), { x, y, w, h, isTextBox: true, margin: 0, fontSize: size || 13, fontFace: 'Arial', color: 'C9C3B6', valign: 'top' });

// ========== 1 TITLE
pres.addSection({ title: 'Open' });
let s = pres.addSlide({ sectionTitle: 'Open' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'TITLE';
s.addShape(pres.ShapeType.roundRect, { x: M, y: 0.7, w: 0.5, h: 0.5, rectRadius: 0.11, fill: { color: 'F2EEE4' }, line: { color: 'F2EEE4' }, objectName: 'mark' });
txt(s, 'ℓ', { x: M + 0.12, y: 0.73, w: 0.3, h: 0.45, fontSize: 22, fontFace: 'Georgia', color: '0E0D0C', italic: true });
txt(s, 'Trail', { x: 1.15, y: 0.78, w: 2, h: 0.4, fontSize: 20, fontFace: 'Georgia', color: 'F2EEE4' });
s.addText('See how you write.', (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
s.addText([
  { text: 'Every draft. Every session. Every ' },
  { text: 'pasted sentence', options: { color: 'E0A64B' } },
  { text: '  chatgpt.com', options: { color: 'E0A64B', fontSize: 9, fontFace: 'Courier New' } },
  { text: ', with its source.' },
], { x: 0.5, y: 3.35, w: 7.2, h: 1.2, isTextBox: true, margin: 0, fontSize: 16, fontFace: 'Arial', color: 'C9C3B6', valign: 'top' });
txt(s, 'A student\'s own record of how an essay was written. Kept on their laptop, signed so nobody can rewrite it, useful every week.', { x: M, y: 4.0, w: 6.6, h: 0.6, fontSize: 12, color: '8B867C' });
// legend
const leg = [['typed, in your hand', '5FCB84'], ['pasted, with its source', 'E0A64B'], ['signed checkpoint', '6B8CFF']];
leg.forEach(([t, c], i) => { s.addShape(pres.ShapeType.rect, { x: M + i * 2.4, y: 4.78, w: 0.12, h: 0.12, fill: { color: c }, line: { color: c }, objectName: 'legend-' + i }); txt(s, t, { x: M + 0.2 + i * 2.4, y: 4.72, w: 2.1, h: 0.25, fontSize: 9, color: '8B867C', fontFace: 'Courier New' }); });
txt(s, 'Claremont accelerator · Abdullah Ali · live at trail-hmc.up.railway.app', { x: M, y: 5.05, w: 8, h: 0.25, fontSize: 9, color: '8B867C', fontFace: 'Courier New' });
s.addNotes('Hi, I am Abdullah and I am building Trail. Open the live demo if there is time: trail-hmc.up.railway.app/demo');

// ========== 2 PROBLEM
pres.addSection({ title: 'Problem' });
s = pres.addSlide({ sectionTitle: 'Problem' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('01  THE PROBLEM', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'A professor flags your essay for AI. You wrote it. You have ' }, { text: 'nothing to show.', options: { italic: true, color: '6B8CFF' } }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
const probs = [
  ['What changed', 'Colleges now run AI detectors on student work. They are wrong often enough that every campus has a story; a 2023 Stanford study found they flagged most essays by non-native English speakers.'],
  ['Who pays', 'The student. "I wrote it" is not evidence. The burden of proof has quietly moved onto them, with no tool on their side of the table.'],
  ['Why now', 'Detectors arrived faster than due process, and AI-use declarations are becoming standard in syllabi. Students need a record of their own work.'],
];
probs.forEach(([e, b], i) => { const x = M + i * 3.05; card(s, x, 2.0, 2.9, 2.75, 'problem-' + i); label(s, e, x + 0.22, 2.2, 2.5, '6B8CFF'); txt(s, b, { x: x + 0.22, y: 2.55, w: 2.46, h: 2.1, fontSize: 11.5 }); });
s.addNotes('The problem in one line: the burden of proof moved onto the student and nobody built anything for their side.');

// ========== 3 DOCS HISTORY
s = pres.addSlide({ sectionTitle: 'Problem' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('02  WHY GOOGLE DOCS HISTORY IS NOT THE ANSWER', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'Version history is ' }, { text: 'Google\'s', options: { italic: true, color: '6B8CFF' } }, { text: ' record. Trail is the student\'s.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
const rows = [
  ['The question a professor asks', 'Docs version history', 'Trail'],
  ['Was this typed or pasted?', 'Cannot tell', 'Every paste, with its source site'],
  ['When was it written, and how fast?', 'Snapshots on Google\'s schedule', 'Keystroke timing, sessions over days'],
  ['Does it work outside Google Docs?', 'No', 'Docs, Notion, Word, Canvas, Moodle, Blackboard, Brightspace'],
  ['What if I copied my draft to a new doc?', 'History resets', 'The record follows the writing'],
  ['Can I hand it over without sharing the doc?', 'No', 'Export a pack; the text stays yours'],
  ['Can anyone prove it was not edited later?', 'No', 'Signed every 10 minutes, verifiable by anyone'],
];
s.addTable(rows.map((r, ri) => r.map((c, ci) => ({ text: c, options: ri === 0
  ? { bold: true, color: HEX.accent5, fontSize: 9, fill: { color: HEX.lt2 } }
  : { color: ci === 0 ? HEX.dk2 : ci === 1 ? HEX.accent5 : HEX.accent2, fontSize: 11, fill: { color: HEX.lt1 } } }))),
  { x: M, y: 1.85, w: 9, colW: [3.2, 2.4, 3.4], border: { type: 'solid', color: '2B2823', pt: 0.5 }, fontFace: 'Arial', margin: [4, 6, 4, 6], rowH: 0.42, objectName: 'compare' });
s.addNotes('Docs history is a backup feature, not a record. It is Google\'s, only in Docs, no timing, no paste source, resets on copy, no integrity guarantee.');

// ========== 4 PRODUCT
pres.addSection({ title: 'Product' });
s = pres.addSlide({ sectionTitle: 'Product' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('03  THE PRODUCT', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'A Chrome extension that records ' }, { text: 'how', options: { italic: true, color: '6B8CFF' } }, { text: ' you write, on your own laptop.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
// replay mock
card(s, M, 1.85, 4.6, 3.15, 'replay');
txt(s, 'Cities and silence · Google Docs', { x: M + 0.22, y: 2.02, w: 3, h: 0.22, fontSize: 8.5, color: '8B867C', fontFace: 'Courier New' });
txt(s, '232 words', { x: M + 3.3, y: 2.02, w: 1.1, h: 0.22, fontSize: 8.5, color: '8B867C', fontFace: 'Courier New', align: 'right' });
s.addText([
  { text: 'Cities are not designed for silence. In the spring of 2020, New York recorded its quietest month since seismographs were installed. ' },
  { text: 'Urban noise fell by roughly half in the first weeks of lockdown', options: { color: 'E0A64B' } },
  { text: ' jstor.org', options: { color: 'E0A64B', fontSize: 8, fontFace: 'Courier New' } },
  { text: ', and the city noticed what it had stopped hearing: itself.' },
], { x: M + 0.22, y: 2.3, w: 4.16, h: 1.9, isTextBox: true, margin: 0, fontSize: 12.5, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' });
s.addShape(pres.ShapeType.rect, { x: M + 0.22, y: 4.35, w: 3.0, h: 0.1, fill: { color: '5FCB84' }, line: { color: '5FCB84' }, objectName: 'bar-typed' });
s.addShape(pres.ShapeType.rect, { x: M + 3.22, y: 4.35, w: 1.16, h: 0.1, fill: { color: 'E0A64B' }, line: { color: 'E0A64B' }, objectName: 'bar-pasted' });
txt(s, 'typed 72%', { x: M + 0.22, y: 4.52, w: 2, h: 0.22, fontSize: 8.5, color: '5FCB84', fontFace: 'Courier New' });
txt(s, 'pasted 28%', { x: M + 2.6, y: 4.52, w: 1.78, h: 0.22, fontSize: 8.5, color: 'E0A64B', fontFace: 'Courier New', align: 'right' });
bullets(s, [
  'Replay any essay like a video. Scrub to the paragraph you rewrote four times.',
  'Every paste is kept with the site it came from. jstor.org is a quotation; chatgpt.com is a conversation to have honestly.',
  'The AI-use declaration your course requires is drafted from what actually happened, not from memory.',
  'If you are ever accused, export an evidence pack anyone can verify in a browser without trusting us.',
  'Trail does not detect AI. It records process, and says so on every page.',
], 5.4, 1.85, 4.1, 3.3, 12);
s.addNotes('Walk through the replay. Point at the paste with its source. The declaration is drafted from the record.');

// ========== 5 TECH
pres.addSection({ title: 'Tech' });
s = pres.addSlide({ sectionTitle: 'Tech' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('04  HOW IT WORKS, IN ONE PICTURE', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'Every event is fingerprinted and chained. Every ten minutes the chain is ' }, { text: 'signed and published.', options: { italic: true, color: '6B8CFF' } }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
const hashes = ['a41f', '9c02', '77be', 'e3d0', 'c01a'];
hashes.forEach((h, i) => {
  const x = M + i * 1.08;
  s.addShape(pres.ShapeType.roundRect, { x, y: 2.15, w: 0.86, h: 0.72, rectRadius: 0.08, fill: { color: '161513' }, line: { color: '2B2823', width: 0.75 }, objectName: 'ev-' + i });
  txt(s, 'ev ' + (i + 1), { x: x + 0.1, y: 2.22, w: 0.7, h: 0.22, fontSize: 9, color: 'C9C3B6', fontFace: 'Courier New' });
  txt(s, '#' + h, { x: x + 0.1, y: 2.5, w: 0.7, h: 0.22, fontSize: 9, color: '6B8CFF', fontFace: 'Courier New' });
  if (i < 4) s.addShape(pres.ShapeType.line, { x: x + 0.86, y: 2.51, w: 0.22, h: 0, line: { color: '6B8CFF', width: 1.5, endArrowType: 'triangle' }, objectName: 'link-' + i });
});
s.addShape(pres.ShapeType.line, { x: M + 5.26, y: 2.51, w: 0.4, h: 0, line: { color: '6B8CFF', width: 1.5, endArrowType: 'triangle' }, objectName: 'link-sign' });
s.addShape(pres.ShapeType.roundRect, { x: M + 5.7, y: 2.15, w: 1.6, h: 0.72, rectRadius: 0.08, fill: { color: '161513' }, line: { color: '2B2823', width: 0.75 }, objectName: 'sign' });
txt(s, 'every 10 min', { x: M + 5.82, y: 2.22, w: 1.4, h: 0.22, fontSize: 9, color: 'C9C3B6', fontFace: 'Courier New' });
txt(s, 'signed by Trail\'s key', { x: M + 5.82, y: 2.5, w: 1.45, h: 0.22, fontSize: 9, color: '5FCB84', fontFace: 'Courier New' });
s.addShape(pres.ShapeType.line, { x: M + 7.3, y: 2.51, w: 0.3, h: 0, line: { color: '6B8CFF', width: 1.5, endArrowType: 'triangle' }, objectName: 'link-log' });
s.addShape(pres.ShapeType.roundRect, { x: M + 7.64, y: 2.15, w: 1.36, h: 0.72, rectRadius: 0.08, fill: { color: '161513' }, line: { color: '2B2823', width: 0.75 }, objectName: 'log' });
txt(s, 'public log', { x: M + 7.76, y: 2.22, w: 1.2, h: 0.22, fontSize: 9, color: 'C9C3B6', fontFace: 'Courier New' });
txt(s, 'append-only', { x: M + 7.76, y: 2.5, w: 1.2, h: 0.22, fontSize: 9, color: '6B8CFF', fontFace: 'Courier New' });
txt(s, 'Each fingerprint includes the previous one, so a change anywhere breaks every link after it.', { x: M, y: 3.05, w: 9, h: 0.3, fontSize: 10.5, color: '8B867C' });
const steps = [
  ['1  On the laptop', 'The extension batches keystrokes, pastes and deletions, each with a fingerprint that includes the one before.'],
  ['2  To the server', 'Only the latest 64-character fingerprint, every ten minutes. Never the text, never the title, never the document address.'],
  ['3  In any browser', 'A professor drops the pack on trail-hmc.up.railway.app/verify. It recomputes everything against the key and log fetched from the site. Change one letter and it names the event.'],
];
steps.forEach(([e, b], i) => { const x = M + i * 3.05; card(s, x, 3.5, 2.9, 1.6, 'step-' + i); label(s, e, x + 0.22, 3.66, 2.5, '6B8CFF'); txt(s, b, { x: x + 0.22, y: 3.95, w: 2.46, h: 1.1, fontSize: 10.5 }); });
s.addNotes('If there is a laptop: open /verify, click Try it with a sample record, then Now tamper with it. The chain breaks at a named event.');

// ========== 6 PROOF
s = pres.addSlide({ sectionTitle: 'Tech' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('05  IT HAD TO PROVE ITSELF BEFORE IT GOT A WEBSITE', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: '320 real essays. 800 simulated ways of writing them. ' }, { text: 'Exact', options: { italic: true, color: '6B8CFF' } }, { text: ' provenance.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
stat(s, M, 2.0, 2.9, 'Lines reconstructed', '4,400', '315,760 words, byte-exact. Line and character provenance 100%.');
stat(s, M + 3.05, 2.0, 2.9, 'Honest writers flagged', '0 / 320', 'Not one human-typed document was called scripted.', '5FCB84');
stat(s, M + 6.1, 2.0, 2.9, 'Scripted essays caught', '160 / 160', 'Every auto-typed ChatGPT essay flagged for uniform rhythm.', 'E0A64B');
txt(s, 'Human and ChatGPT essays from public datasets (Ghostbuster, HC3), pushed through typed, pasted-whole, pasted-in-chunks, auto-typed and quoted processes with known ground truth. The analysis never reads the text. That is the point: Trail records process, it does not judge content.', { x: M, y: 4.05, w: 9, h: 0.9, fontSize: 12, color: 'C9C3B6' });
s.addNotes('The validation report is in the repo: backtest-out/real-report.md. It opens by saying Trail does not detect AI text.');

// ========== 7 WEEKLY VALUE
pres.addSection({ title: 'Business' });
s = pres.addSlide({ sectionTitle: 'Business' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('06  USEFUL EVERY WEEK, NOT JUST IN A CRISIS', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'The evidence pack is one item on a menu. ' }, { text: 'The habit', options: { italic: true, color: '6B8CFF' } }, { text: ' is the product.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
const feats = [
  ['Replay', 'Watch 2,000 words happen', 'The essay at forty seconds a session. Most tools keep the final version; Trail keeps the whole thing.'],
  ['Patterns', 'Your process, in numbers', 'Best hour, median session, typed share, how much you rewrite. Nothing is sent anywhere.'],
  ['Time', 'Screen time for homework', 'Active minutes by class and assignment on Canvas and friends, a streak, plain habit lines. No teacher view.'],
  ['Declaration', 'Written from what happened', 'The AI-use statement more courses require, drafted from the record. You edit it, you sign it.'],
  ['Pack', 'If anyone ever asks', 'One click. Verifiable by anyone, in a browser, without trusting Trail.'],
  ['Privacy', 'Nothing leaves the laptop', 'The server holds email, fingerprints and signatures. Deleting the account deletes all of it.'],
];
feats.forEach(([e, h, b], i) => { const col = i % 3, row = Math.floor(i / 3); cardText(s, M + col * 3.05, 1.85 + row * 1.6, 2.9, 1.48, e, h, b, 'feat-' + i); });
s.addNotes('This is the answer to retention: a reason to open Trail weekly. The homework time view came from an instructor suggestion.');

// ========== 8 CUSTOMERS
s = pres.addSlide({ sectionTitle: 'Business' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('07  CUSTOMERS AND HOW WE GET THEM', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'Start with the students who are ' }, { text: 'most afraid', options: { italic: true, color: '6B8CFF' } }, { text: ', and let the product carry itself.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
const acq = [
  ['Wedge', 'International students at three campuses', 'Flagged most, talk to each other most. Claremont is one of the three.'],
  ['Loop 1', 'Invite three, get a semester', 'An invite counts when the friend finishes a first replay, not at sign-up. Nine invites, three free semesters.'],
  ['Loop 2', 'The verify page is the ad', 'Every pack a student hands a professor points to the verify page. The person checking it is the next one recommending it.'],
  ['Loop 3', 'The declaration travels', 'A declaration "generated from my writing record" at the foot of an essay is read by every grader. Writing centres ask where it came from.'],
  ['Channel', 'Chrome Web Store, one click', 'Five dollars once, no per-install cost. "Add to Chrome" is the funnel; the first replay is the activation.'],
  ['Cost', 'Acquisition cost near zero', 'No ads. Students sell it to students. Free early access is the entire marketing budget.'],
];
acq.forEach(([e, h, b], i) => { const col = i % 3, row = Math.floor(i / 3); cardText(s, M + col * 3.05, 1.85 + row * 1.6, 2.9, 1.48, e, h, b, 'acq-' + i); if (e.startsWith('Loop')) s.addShape(pres.ShapeType.ellipse, { x: M + col * 3.05 + 2.55, y: 1.85 + row * 1.6 + 0.2, w: 0.12, h: 0.12, fill: { color: '6B8CFF' }, line: { color: '6B8CFF' }, objectName: 'loop-dot-' + i }); });
s.addNotes('Three loops, each built into the product rather than bought.');

// ========== 9 MODEL
s = pres.addSlide({ sectionTitle: 'Business' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('08  BUSINESS MODEL', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'Sold only to students. ' }, { text: 'Never', options: { italic: true, color: '6B8CFF' } }, { text: ' to institutions.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
stat(s, M, 1.85, 2.9, 'Semester plan', '$12', 'Every four months. One coffee a month.');
stat(s, M + 3.05, 1.85, 2.9, 'Monthly', '$3.99', 'Same features, month to month.');
stat(s, M + 6.1, 1.85, 2.9, 'Server cost per user', '< 2¢', 'Per month at current scale. The server stores fingerprints, not text. Estimate from our hosting bill.');
bullets(s, [
  'Free during early access. Fourteen days free with every feature once pricing switches on, no card.',
  'Recording, local storage, export and checkpoint signing never lock, paid or not. Holding the record hostage would make the whole thing pointless.',
  'Refusing institutional contracts is the moat. The moment a university is the customer, Trail becomes surveillance and students stop installing it.',
  'Cancel in one click, full refund within fourteen days, renewal reminder seven days before.',
], M, 3.75, 9, 1.4, 11.5);
s.addNotes('The moat is the refusal. Student-side trust is the whole product.');

// ========== 10 MARKET
s = pres.addSlide({ sectionTitle: 'Business' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('09  MARKET', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'About nineteen million US college students. One in a hundred is a ' }, { text: 'real company.', options: { italic: true, color: '6B8CFF' } }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
stat(s, M, 1.9, 2.9, 'US college students', '~19M', 'Roughly 1.1 million of them international, the wedge.');
stat(s, M + 3.05, 1.9, 2.9, 'At 1% on the semester plan', '$4.6M', '190,000 students × $24 a year. Illustrative, not a forecast.', '5FCB84');
stat(s, M + 6.1, 1.9, 2.9, 'Gross margin', '~95%', 'Fingerprints are cheap to store and sign. Support and payments are the real costs.');
// simple scale bar: 19M vs 1.1M vs 190k
const scaleX = M, scaleY = 4.05, scaleW = 9;
s.addShape(pres.ShapeType.rect, { x: scaleX, y: scaleY, w: scaleW, h: 0.22, fill: { color: '161513' }, line: { color: '2B2823' }, objectName: 'scale-all' });
s.addShape(pres.ShapeType.rect, { x: scaleX, y: scaleY, w: scaleW * 1.1 / 19, h: 0.22, fill: { color: '6B8CFF' }, line: { color: '6B8CFF' }, objectName: 'scale-intl' });
s.addShape(pres.ShapeType.rect, { x: scaleX, y: scaleY, w: Math.max(0.05, scaleW * 0.19 / 19), h: 0.22, fill: { color: '5FCB84' }, line: { color: '5FCB84' }, objectName: 'scale-1pct' });
txt(s, 'To scale: all US college students (grey), international students (blue), the one-percent case (green). Every essay-writing student in the English-speaking world faces the same detectors; only the LMS adapters change by country.', { x: M, y: 4.38, w: 9, h: 0.6, fontSize: 10.5, color: '8B867C' });
s.addNotes('Sources to confirm before presenting: NCES fall enrollment for the 19M; Open Doors for international students.');

// ========== 11 ROADMAP
pres.addSection({ title: 'Close' });
s = pres.addSlide({ sectionTitle: 'Close' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'CONTENT';
s.addText('10  WHERE IT IS, AND WHAT IS NEXT', { x: 0.5, y: 0.32, w: 8, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, fontFace: 'Arial', color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'Live, signed, verifiable. ' }, { text: 'Three weeks', options: { italic: true, color: '6B8CFF' } }, { text: ' from a blank folder.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
const road = [
  ['shipped', 'Site, app, extension 0.3.0, Google sign-in, free early access, Postgres on Railway', true],
  ['shipped', 'Live demo with six real essays, verify page with a "tamper with it" test, homework time log', true],
  ['shipped', 'Validation on 320 real human and ChatGPT essays, report published in the repo', true],
  ['next', 'Chrome Web Store listing, so "Add to Chrome" is one click. Review is the critical path.', false],
  ['next', 'Canvas connection with the student\'s own token: course names, due dates, time against deadlines', false],
  ['next', 'Domain, production sign-in, Gradescope page adapter, first campus pilot at Claremont', false],
  ['later', 'Firefox and Safari, Word desktop, student-initiated "share my time summary"', false],
];
road.forEach(([k, v, done], i) => {
  const y = 1.9 + i * 0.42;
  txt(s, k.toUpperCase(), { x: M, y, w: 1.0, h: 0.3, fontSize: 9, color: done ? '5FCB84' : '8B867C', fontFace: 'Courier New', charSpacing: 1 });
  txt(s, v, { x: M + 1.1, y: y - 0.02, w: 7.9, h: 0.36, fontSize: 11.5, color: done ? 'F2EEE4' : 'C9C3B6' });
  s.addShape(pres.ShapeType.line, { x: M, y: y + 0.36, w: 9, h: 0, line: { color: '2B2823', width: 0.5 }, objectName: 'road-rule-' + i });
});
s.addNotes('Web Store review is the long pole; it has been submitted / will be submitted this week.');

// ========== 12 CLOSE
s = pres.addSlide({ sectionTitle: 'Close' }); s.background = { color: '0E0D0C' }; s.addText('Trail · trail-hmc.up.railway.app', { x: 0.5, y: 5.2, w: 5, h: 0.25, isTextBox: true, margin: 0, fontSize: 9, fontFace: 'Arial', color: '8B867C' }); s.__t = 'TITLE';
s.addText('11  THE ASK', { x: M, y: 0.8, w: 6, h: 0.3, isTextBox: true, margin: 0, fontSize: 10, color: '6B8CFF', charSpacing: 2 });
s.addText([{ text: 'Proof you wrote it. ' }, { text: 'Kept by you,', options: { italic: true, color: '6B8CFF' } }, { text: ' not by Google.' }], (s.__t === 'TITLE' ? { x: 0.5, y: 1.55, w: 9, h: 1.7, isTextBox: true, margin: 0, fontSize: 54, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' } : { x: 0.5, y: 0.62, w: 9, h: 1.15, isTextBox: true, margin: 0, fontSize: 30, fontFace: 'Georgia', color: 'F2EEE4', valign: 'top' }));
s.addText('A place in the cohort. Introductions to writing centres at the Claremont colleges. Students who will record one real essay and tell us what confused them.', { x: 0.5, y: 3.35, w: 7.2, h: 1.2, isTextBox: true, margin: 0, fontSize: 16, fontFace: 'Arial', color: 'C9C3B6', valign: 'top' });
s.addShape(pres.ShapeType.roundRect, { x: M, y: 4.55, w: 2.9, h: 0.5, rectRadius: 0.1, fill: { color: 'F2EEE4' }, line: { color: 'F2EEE4' }, objectName: 'cta' });
txt(s, 'Watch a real essay replay  →', { x: M + 0.2, y: 4.66, w: 2.6, h: 0.3, fontSize: 12, bold: true, color: '0E0D0C' });
txt(s, 'trail-hmc.up.railway.app/demo', { x: 3.6, y: 4.68, w: 4, h: 0.3, fontSize: 11, color: 'C9C3B6', fontFace: 'Courier New' });
txt(s, 'Built for students, not against them.', { x: M, y: 5.15, w: 6, h: 0.25, fontSize: 9, color: '8B867C', fontFace: 'Courier New' });
s.addNotes('End on the line and the URL.');

(async () => {
  await pres.writeFile({ fileName: 'Trail-Pitch-GoogleSlides.pptx' });
  console.log('wrote Trail-Pitch-GoogleSlides.pptx');
})();

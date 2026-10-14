// Builds Trail-Pitch-Short.pptx: three slides for a two-minute pitch. Run: NODE_PATH=./node_modules node build-short.js
const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/Users/abdullahali/.claude/skills/synced/ab057bf1-add7-4f71-88e5-a7b2da849d21_1b0fe76c-179c-47ff-91fd-bbd4bf814ecf/pptx/scripts/apply_theme.js');

const THEME = { name: 'Trail Ink', headFontFace: 'Georgia', bodyFontFace: 'Arial', colors: { dk1: 'F2EEE4', lt1: '0E0D0C', dk2: 'C9C3B6', lt2: '161513', accent1: '6B8CFF', accent2: '5FCB84', accent3: 'E0A64B', accent4: 'E06A5A', accent5: '8B867C', accent6: '2A49C9', hlink: '6B8CFF', folHlink: '6B8CFF' } };
const HEX = THEME.colors;
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.theme = { headFontFace: 'Georgia', bodyFontFace: 'Arial' };
pres.title = 'Trail Two-Minute Pitch'; pres.author = 'Abdullah Ali';
const C = pres.SchemeColor; const M = 0.5, W = 10, H = 5.625;

pres.defineSlideMaster({
  title: 'CONTENT', background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: 'eyebrow', type: 'body', x: M, y: 0.32, w: 6, h: 0.3, fontSize: 10, color: C.accent1, charSpacing: 2, margin: 0 }, text: 'Eyebrow' } },
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.62, w: 9, h: 1.1, fontSize: 32, color: C.text1, valign: 'top', margin: 0 }, text: 'Title' } },
    { text: { text: 'Trail · trail-hmc.up.railway.app', options: { x: M, y: H - 0.42, w: 5, h: 0.25, fontSize: 9, color: C.accent5, margin: 0 } } },
  ],
  slideNumber: { x: W - 1.0, y: H - 0.42, w: 0.5, h: 0.25, fontSize: 9, color: C.accent5 },
});
const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 13, color: C.text2, valign: 'top' }, o));
const card = (s, x, y, w, h, name) => s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: C.background2 }, line: { color: '2B2823', width: 0.75 }, objectName: name });
const label = (s, t, x, y, w, color) => txt(s, t.toUpperCase(), { x, y, w, h: 0.25, fontSize: 9, color: color || C.accent5, charSpacing: 2, bold: true });
const stat = (s, x, y, w, k, v, d, vColor) => { label(s, k, x, y, w); txt(s, v, { x, y: y + 0.28, w, h: 0.7, fontSize: 36, fontFace: 'Georgia', color: vColor || C.text1 }); txt(s, d, { x, y: y + 1.0, w, h: 0.6, fontSize: 11, color: C.text2 }); };
pres.addSection({ title: 'Pitch' });

// ---- 1 PROBLEM (0:00-0:40)
let s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Pitch' });
s.addText('TRAIL  ·  1 / 3  ·  THE PROBLEM', { placeholder: 'eyebrow' });
s.addText([{ text: 'A professor flags your essay for AI. You wrote it. You have ' }, { text: 'nothing to show.', options: { italic: true, color: C.accent1 } }], { placeholder: 'title' });
const left = [
  ['What changed', 'Colleges run AI detectors on student work. They are wrong often enough that every campus has a story; a 2023 Stanford study found them flagging most essays by non-native English speakers.'],
  ['Who pays', 'The student. "I wrote it" is not evidence. The burden of proof has landed on them, and nobody has built anything for their side of the table.'],
];
left.forEach(([e, b], i) => { const y = 1.95 + i * 1.5; card(s, M, y, 4.4, 1.38, 'p-' + i); label(s, e, M + 0.22, y + 0.18, 4, C.accent1); txt(s, b, { x: M + 0.22, y: y + 0.48, w: 3.96, h: 0.85, fontSize: 11.5 }); });
// right: why not docs history
card(s, 5.1, 1.95, 4.4, 2.88, 'docs');
label(s, 'Why Google Docs history is not the answer', 5.32, 2.13, 4, C.accent3);
s.addText([
  { text: 'It is Google\'s record, not the student\'s.', options: { bullet: { code: '2014' }, breakLine: true, paraSpaceAfter: 5 } },
  { text: 'It only exists inside Google Docs.', options: { bullet: { code: '2014' }, breakLine: true, paraSpaceAfter: 5 } },
  { text: 'It cannot tell typing from pasting, or where a paste came from.', options: { bullet: { code: '2014' }, breakLine: true, paraSpaceAfter: 5 } },
  { text: 'It resets the moment you copy your draft to a new document.', options: { bullet: { code: '2014' }, breakLine: true, paraSpaceAfter: 5 } },
  { text: 'It cannot prove nothing was edited later.', options: { bullet: { code: '2014' } } },
], { x: 5.32, y: 2.45, w: 3.96, h: 2.3, isTextBox: true, margin: 0, fontSize: 11.5, color: C.text2, valign: 'top' });
s.addNotes('0:00 to 0:40. Here is a situation happening on every campus. A professor runs an essay through a detector, it flags it, the student wrote every word, and they have nothing to show. "I wrote it" is not evidence. Docs history is Google\'s record and cannot tell typing from pasting.');

// ---- 2 PRODUCT + PROOF (0:40-1:30)
s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Pitch' });
s.addText('TRAIL  ·  2 / 3  ·  THE PRODUCT', { placeholder: 'eyebrow' });
s.addText([{ text: 'A Chrome extension that records ' }, { text: 'how', options: { italic: true, color: C.accent1 } }, { text: ' you write, on your own laptop. Signed, so anyone can verify it.' }], { placeholder: 'title' });
// replay mock
card(s, M, 1.95, 4.4, 1.95, 'replay');
txt(s, 'Cities and silence · Google Docs', { x: M + 0.22, y: 2.1, w: 3, h: 0.22, fontSize: 8.5, color: C.accent5, fontFace: 'Courier New' });
s.addText([
  { text: 'In the spring of 2020, New York recorded its quietest month since seismographs were installed. ' },
  { text: 'Urban noise fell by roughly half in the first weeks of lockdown', options: { color: C.accent3, highlight: '3A2E14' } },
  { text: ' jstor.org', options: { color: C.accent3, fontSize: 8, fontFace: 'Courier New' } },
  { text: ', and the city noticed what it had stopped hearing: itself.' },
], { x: M + 0.22, y: 2.36, w: 3.96, h: 1.1, isTextBox: true, margin: 0, fontSize: 11, fontFace: 'Georgia', color: C.text1, valign: 'top' });
s.addShape(pres.ShapeType.rect, { x: M + 0.22, y: 3.52, w: 2.85, h: 0.09, fill: { color: C.accent2 }, line: { color: C.accent2 }, objectName: 'bar-t' });
s.addShape(pres.ShapeType.rect, { x: M + 3.07, y: 3.52, w: 1.11, h: 0.09, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: 'bar-p' });
txt(s, 'typed 72%', { x: M + 0.22, y: 3.65, w: 2, h: 0.2, fontSize: 8.5, color: C.accent2, fontFace: 'Courier New' });
txt(s, 'pasted 28% · 1 paste, with source', { x: M + 1.6, y: 3.65, w: 2.58, h: 0.2, fontSize: 8.5, color: C.accent3, fontFace: 'Courier New', align: 'right' });
// what you get
s.addText([
  { text: 'Replay the essay like a video. See your patterns and your time on school sites.', options: { bullet: { code: '2014' }, breakLine: true, paraSpaceAfter: 5 } },
  { text: 'Every paste kept with the site it came from. The AI-use declaration your course requires, drafted from what happened.', options: { bullet: { code: '2014' }, breakLine: true, paraSpaceAfter: 5 } },
  { text: 'Every 10 minutes the record is signed and published to a public log. If accused, export a pack any professor can verify in a browser. Change one letter and it fails.', options: { bullet: { code: '2014' }, breakLine: true, paraSpaceAfter: 5 } },
  { text: 'Trail does not detect AI. It records process.', options: { bullet: { code: '2014' }, color: C.text1 } },
], { x: 5.1, y: 1.95, w: 4.4, h: 2.0, isTextBox: true, margin: 0, fontSize: 11.5, color: C.text2, valign: 'top' });
// proof row
label(s, 'Proof before it got a website: 320 real essays, 800 simulated writing processes', M, 4.1, 9, C.accent5);
stat(s, M, 4.38, 2.9, 'Lines reconstructed', '4,400', 'provenance exact');
stat(s, M + 3.05, 4.38, 2.9, 'Honest writers flagged', '0 / 320', 'zero false alarms', C.accent2);
stat(s, M + 6.1, 4.38, 2.9, 'Scripted essays caught', '160 / 160', 'every auto-typed one', C.accent3);
s.addNotes('0:40 to 1:30. Trail records how you write, on your laptop: keystrokes with timing, every paste and its source, sessions over days. Signed every ten minutes, verifiable by anyone. Every week: replay, patterns, time, declaration. Proof: 320 real essays, 800 processes, zero of 320 honest writers flagged, all 160 scripted ones caught. Trail does not detect AI.');

// ---- 3 BUSINESS + ASK (1:30-2:00)
s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Pitch' });
s.addText('TRAIL  ·  3 / 3  ·  THE BUSINESS AND THE ASK', { placeholder: 'eyebrow' });
s.addText([{ text: 'Sold only to students, never to institutions. ' }, { text: 'Live today, free.', options: { italic: true, color: C.accent1 } }], { placeholder: 'title' });
stat(s, M, 1.95, 2.9, 'Price', '$12', 'a semester, or $3.99 a month, after free early access');
stat(s, M + 3.05, 1.95, 2.9, 'US college students', '~19M', '1.1M international: the wedge, flagged most, talk most');
stat(s, M + 6.1, 1.95, 2.9, 'At 1% on the semester plan', '$4.6M', 'a year. Illustrative, not a forecast', C.accent2);
const rows = [
  ['Why students sell it', 'Invite three friends who finish a first replay, get a semester free. Every verified pack points a professor at trail.app/verify. The declaration at the foot of an essay is read by every grader.'],
  ['Why we refuse institutions', 'The moment a university is the customer, Trail becomes surveillance and students stop installing it. The refusal is the moat.'],
];
rows.forEach(([e, b], i) => { const x = M + i * 4.6; card(s, x, 3.65, 4.4, 1.1, 'r-' + i); label(s, e, x + 0.22, 3.8, 4, C.accent1); txt(s, b, { x: x + 0.22, y: 4.06, w: 3.96, h: 0.65, fontSize: 10.5 }); });
s.addShape(pres.ShapeType.roundRect, { x: M, y: 4.9, w: 9, h: 0.42, rectRadius: 0.1, fill: { color: C.text1 }, line: { color: C.text1 }, objectName: 'ask' });
txt(s, 'The ask: a place in the cohort, introductions to writing centres at the Claremont colleges, and students who will record one real essay.   trail-hmc.up.railway.app', { x: M + 0.2, y: 4.99, w: 8.6, h: 0.28, fontSize: 10.5, bold: true, color: C.background1 });
s.addNotes('1:30 to 2:00. Live today, free, at trail-hmc.up.railway.app. Sold only to students, never institutions. Twelve dollars a semester, nineteen million students facing the same detectors. The ask: a place in the cohort, writing-centre introductions, students who will record one real essay. Proof you wrote it, kept by you, not by Google.');

(async () => { await pres.writeFile({ fileName: 'Trail-Pitch-Short.pptx' }); await applyTheme('Trail-Pitch-Short.pptx', THEME); console.log('wrote Trail-Pitch-Short.pptx'); })();

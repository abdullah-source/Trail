// The hero headline, written in front of you: "See how you write." is typed with a caret, then
// a line beneath is typed, one phrase is pasted (highlighter wash + source chip), a typo is
// backspaced and fixed. About four seconds, then it settles. This is the one text animation
// on the site besides the replay (DESIGN.md §5). No layout shift: the finished text is laid
// out invisibly underneath and the animated copy sits on top of it in the same grid cell.
import { useEffect, useMemo, useState } from 'react';
import { usePrefersReducedMotion } from './motion';

type Step = { at: number; line: 0 | 1; text: string; paste?: boolean; del?: number };

const HEAD = 'See how you write.';
const L2A = 'Every draft. Every session. Every ';
const L2_PASTE = 'pasted sentence';
const L2_SRC = 'chatgpt.com';
const L2B = ', with its sourse';
const L2C = 'ce.';
const FINAL_L2 = `${L2A}${L2_PASTE}, with its source.`;

/** Compile the script into timed steps. Each step yields the visible state of both lines. */
function compile(): { steps: Step[]; total: number } {
  const steps: Step[] = [];
  let t = 250;
  let head = '';
  for (const ch of HEAD) {
    t += ch === ' ' ? 90 : 58;
    head += ch;
    steps.push({ at: t, line: 0, text: head });
  }
  t += 420;
  let l2 = '';
  for (const ch of L2A) {
    t += ch === ' ' ? 44 : 30;
    if (ch === '.') t += 120;
    l2 += ch;
    steps.push({ at: t, line: 1, text: l2 });
  }
  t += 260;
  l2 += L2_PASTE;
  steps.push({ at: t, line: 1, text: l2, paste: true });
  t += 380;
  for (const ch of L2B) {
    t += ch === ' ' ? 44 : 30;
    l2 += ch;
    steps.push({ at: t, line: 1, text: l2, paste: true });
  }
  t += 300;
  for (let i = 0; i < 2; i++) {
    t += 85;
    l2 = l2.slice(0, -1);
    steps.push({ at: t, line: 1, text: l2, paste: true, del: 1 });
  }
  t += 120;
  for (const ch of L2C) {
    t += 60;
    l2 += ch;
    steps.push({ at: t, line: 1, text: l2, paste: true });
  }
  return { steps, total: t };
}

export function TypedHeadline({ className = '' }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const { steps, total } = useMemo(compile, []);
  const [k, setK] = useState(reduced ? steps.length : 0);
  const done = k >= steps.length;

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const el = now - start;
      let n = 0;
      while (n < steps.length && steps[n].at <= el) n++;
      setK(n);
      if (n < steps.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, steps, total]);

  // visible state
  let head = '';
  let l2 = '';
  let pasted = false;
  for (let i = 0; i < k; i++) {
    const s = steps[i];
    if (s.line === 0) head = s.text;
    else {
      l2 = s.text;
      pasted = !!s.paste;
    }
  }
  const caretOn = !reduced && !done;
  const caretLine: 0 | 1 = k > 0 && steps[k - 1].line === 1 ? 1 : 0;
  const line2 = pasted ? { pre: L2A, paste: L2_PASTE, post: l2.slice(L2A.length + L2_PASTE.length) } : { pre: l2, paste: '', post: '' };
  const showCaretOnEmptyL2 = caretOn && caretLine === 0 && head === HEAD && l2 === '';

  return (
    <div className={`grid gap-4 ${className}`}>
      <div className="grid">
        {/* sizing copy, invisible, so the block never changes height */}
        <h1 className="text-4xl sm:text-5xl invisible [grid-area:1/1]" aria-hidden>
          {HEAD}
        </h1>
        <h1 className="text-4xl sm:text-5xl [grid-area:1/1]">
          {head}
          {caretOn && caretLine === 0 && !showCaretOnEmptyL2 && <Caret />}
        </h1>
      </div>
      <div className="grid">
        <p className="essay text-xl sm:text-2xl leading-snug invisible [grid-area:1/1]" aria-hidden>
          {FINAL_L2}
        </p>
        <p className="essay text-xl sm:text-2xl leading-snug [grid-area:1/1]" aria-label={FINAL_L2}>
          {line2.pre}
          {line2.paste && (
            <>
              <span className="inline-block align-baseline font-mono text-[10px] leading-none tracking-wide text-paste border border-paste/50 rounded-sm px-1 py-[2px] mr-1 select-none" aria-hidden>
                {L2_SRC}
              </span>
              <span className="prov-paste">{line2.paste}</span>
            </>
          )}
          {line2.post}
          {(caretOn && caretLine === 1) || showCaretOnEmptyL2 ? <Caret /> : null}
        </p>
      </div>
    </div>
  );
}

function Caret() {
  return <span className="caret" aria-hidden style={{ animation: 'none' }} />;
}

export default TypedHeadline;

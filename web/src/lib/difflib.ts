// Port of CPython difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes()
// over arrays of code points. Needed so resync reconciliation matches document.py exactly.

export type Opcode = ['equal' | 'replace' | 'insert' | 'delete', number, number, number, number];

type Match = [number, number, number];

export function getOpcodes(a: string[], b: string[]): Opcode[] {
  const b2j = new Map<string, number[]>();
  for (let i = 0; i < b.length; i++) {
    const ch = b[i];
    let arr = b2j.get(ch);
    if (!arr) {
      arr = [];
      b2j.set(ch, arr);
    }
    arr.push(i);
  }

  function findLongestMatch(alo: number, ahi: number, blo: number, bhi: number): Match {
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map<number, number>();
      const js = b2j.get(a[i]);
      if (js) {
        for (const j of js) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.get(j - 1) || 0) + 1;
          newj2len.set(j, k);
          if (k > bestsize) {
            besti = i - k + 1;
            bestj = j - k + 1;
            bestsize = k;
          }
        }
      }
      j2len = newj2len;
    }
    // No junk: the extension loops in CPython only matter with isjunk; with none, the
    // "popular" set is empty (autojunk=False), so nothing else to do.
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti -= 1;
      bestj -= 1;
      bestsize += 1;
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) {
      bestsize += 1;
    }
    return [besti, bestj, bestsize];
  }

  const la = a.length;
  const lb = b.length;
  const queue: [number, number, number, number][] = [[0, la, 0, lb]];
  const matching: Match[] = [];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const [i, j, k] = findLongestMatch(alo, ahi, blo, bhi);
    if (k) {
      matching.push([i, j, k]);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  matching.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  // Collapse adjacent equal blocks.
  let i1 = 0, j1 = 0, k1 = 0;
  const nonAdjacent: Match[] = [];
  for (const [i2, j2, k2] of matching) {
    if (i1 + k1 === i2 && j1 + k1 === j2) {
      k1 += k2;
    } else {
      if (k1) nonAdjacent.push([i1, j1, k1]);
      i1 = i2; j1 = j2; k1 = k2;
    }
  }
  if (k1) nonAdjacent.push([i1, j1, k1]);
  nonAdjacent.push([la, lb, 0]);

  const answer: Opcode[] = [];
  let i = 0, j = 0;
  for (const [ai, bj, size] of nonAdjacent) {
    let tag: Opcode[0] | '' = '';
    if (i < ai && j < bj) tag = 'replace';
    else if (i < ai) tag = 'delete';
    else if (j < bj) tag = 'insert';
    if (tag) answer.push([tag, i, ai, j, bj]);
    i = ai + size;
    j = bj + size;
    if (size) answer.push(['equal', ai, i, bj, j]);
  }
  return answer;
}

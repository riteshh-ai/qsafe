/**
 * Port of the parts of Python's `difflib` that the intent engine's fuzzy tier depends on:
 * `SequenceMatcher.ratio()` and `get_close_matches()`.
 *
 * There is no npm package that reproduces CPython's Ratcliff–Obershelp variant faithfully,
 * and the fuzzy tier fires at cutoff 0.85 — close enough to the boundary that an
 * approximate similarity metric would flip real classifications. So this mirrors
 * `Lib/difflib.py` directly, including the autojunk heuristic and the tie-breaking order
 * of `heapq.nlargest`.
 *
 * Sequences are compared by code point (Python `str` semantics), not UTF-16 code unit.
 */

/** Python's `difflib._calculate_ratio`. */
function calculateRatio(matches, length) {
  if (!length) return 1.0;
  return (2.0 * matches) / length;
}

export class SequenceMatcher {
  constructor() {
    this.a = [];
    this.b = [];
    this.b2j = new Map();
    this.bpopular = new Set();
    this.fullbcount = null;
    this.autojunk = true;
  }

  /** @param {string} a */
  setSeq1(a) {
    const chars = Array.from(a);
    this.a = chars;
  }

  /** @param {string} b */
  setSeq2(b) {
    this.b = Array.from(b);
    this.fullbcount = null;
    this.#chainB();
  }

  /** Python's `SequenceMatcher.__chain_b` (isjunk is always None for our call sites). */
  #chainB() {
    const b = this.b;
    const b2j = new Map();
    for (let i = 0; i < b.length; i += 1) {
      const elt = b[i];
      const bucket = b2j.get(elt);
      if (bucket) bucket.push(i);
      else b2j.set(elt, [i]);
    }

    // Purge "popular" elements. Only engages for sequences of 200+ elements, but a long
    // free-text query can reach that, and omitting it would change the match there.
    const popular = new Set();
    const n = b.length;
    if (this.autojunk && n >= 200) {
      const ntest = Math.floor(n / 100) + 1;
      for (const [elt, idxs] of b2j) {
        if (idxs.length > ntest) popular.add(elt);
      }
      for (const elt of popular) b2j.delete(elt);
    }

    this.b2j = b2j;
    this.bpopular = popular;
  }

  /**
   * Python's `find_longest_match`. With isjunk=None the junk-extension loops are inert,
   * so only the plain equality extension is kept.
   */
  #findLongestMatch(alo, ahi, blo, bhi) {
    const { a, b, b2j } = this;
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;

    let j2len = new Map();
    for (let i = alo; i < ahi; i += 1) {
      const newj2len = new Map();
      const indices = b2j.get(a[i]);
      if (indices) {
        for (const j of indices) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.get(j - 1) ?? 0) + 1;
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

    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti -= 1;
      bestj -= 1;
      bestsize += 1;
    }
    while (
      besti + bestsize < ahi &&
      bestj + bestsize < bhi &&
      a[besti + bestsize] === b[bestj + bestsize]
    ) {
      bestsize += 1;
    }

    return [besti, bestj, bestsize];
  }

  /**
   * Total size of all matching blocks.
   *
   * `ratio()` only needs the sum, and merging adjacent blocks (which Python does for
   * `get_matching_blocks`) preserves it, so the merge step is skipped.
   */
  #totalMatches() {
    const la = this.a.length;
    const lb = this.b.length;
    const queue = [[0, la, 0, lb]];
    let total = 0;

    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop();
      const [i, j, k] = this.#findLongestMatch(alo, ahi, blo, bhi);
      if (k) {
        total += k;
        if (alo < i && blo < j) queue.push([alo, i, blo, j]);
        if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
      }
    }
    return total;
  }

  /** Similarity in [0, 1]. */
  ratio() {
    return calculateRatio(this.#totalMatches(), this.a.length + this.b.length);
  }

  /** Cheap upper bound on `ratio()`. */
  realQuickRatio() {
    const la = this.a.length;
    const lb = this.b.length;
    return calculateRatio(Math.min(la, lb), la + lb);
  }

  /** Tighter upper bound on `ratio()`, based on multiset intersection. */
  quickRatio() {
    if (this.fullbcount === null) {
      const counts = new Map();
      for (const elt of this.b) counts.set(elt, (counts.get(elt) ?? 0) + 1);
      this.fullbcount = counts;
    }
    const avail = new Map();
    let matches = 0;
    for (const elt of this.a) {
      const numb = avail.has(elt) ? avail.get(elt) : (this.fullbcount.get(elt) ?? 0);
      avail.set(elt, numb - 1);
      if (numb > 0) matches += 1;
    }
    return calculateRatio(matches, this.a.length + this.b.length);
  }
}

/**
 * Python's `difflib.get_close_matches`.
 *
 * Note the sequence assignment: the query is seq2 and each candidate is seq1, which is
 * not symmetric — swapping them changes the result.
 *
 * @param {string} word the query
 * @param {Iterable<string>} possibilities candidates
 * @param {number} n maximum results
 * @param {number} cutoff minimum ratio, inclusive
 * @returns {string[]} best matches, descending by (ratio, candidate)
 */
export function getCloseMatches(word, possibilities, n = 3, cutoff = 0.6) {
  if (n <= 0) throw new Error(`n must be > 0: ${n}`);
  if (cutoff < 0.0 || cutoff > 1.0) throw new Error(`cutoff must be in [0.0, 1.0]: ${cutoff}`);

  const matcher = new SequenceMatcher();
  matcher.setSeq2(word);

  const result = [];
  for (const candidate of possibilities) {
    matcher.setSeq1(candidate);
    if (
      matcher.realQuickRatio() >= cutoff &&
      matcher.quickRatio() >= cutoff
    ) {
      const score = matcher.ratio();
      if (score >= cutoff) result.push([score, candidate]);
    }
  }

  // heapq.nlargest orders by the whole tuple: score first, then the candidate string.
  // Preserving the secondary key keeps tie-breaking identical to Python.
  result.sort((x, y) => {
    if (y[0] !== x[0]) return y[0] - x[0];
    if (y[1] === x[1]) return 0;
    return y[1] > x[1] ? 1 : -1;
  });

  return result.slice(0, n).map(([, candidate]) => candidate);
}

export default { SequenceMatcher, getCloseMatches };

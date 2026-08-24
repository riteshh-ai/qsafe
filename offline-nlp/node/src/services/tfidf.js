/**
 * TF-IDF feature extraction — a faithful reimplementation of scikit-learn's
 * `FeatureUnion([word TfidfVectorizer, char TfidfVectorizer])` transform path.
 *
 * Verified bit-faithful against sklearn over 408 samples (400 real dataset rows plus
 * empty / whitespace-only / Devanagari / Romanized / numeric edge cases): 408/408 exact
 * feature indices, max |delta| 5e-13 (float64 rounding).
 *
 * Fitted configuration this port assumes (asserted at export time):
 *   sublinear_tf=False, smooth_idf=True, norm='l2', binary=False, lowercase=False
 *   word: analyzer='word', ngram_range=(1,2), token_pattern=r'(?u)\b\w\w+\b'
 *   char: analyzer='char', ngram_range=(2,5)
 *
 * Each block is L2-normalised independently and then concatenated, exactly as
 * FeatureUnion does — the combined vector therefore has norm sqrt(2), not 1.
 */

/**
 * Python's `(?u)\b\w\w+\b`.
 *
 * Two traps this encodes:
 *   1. Python's `\w` is "alphanumeric or underscore" — it EXCLUDES Unicode marks (Mn/Mc),
 *      so Devanagari vowel signs, virama and anusvara are token separators. `भूकम्प`
 *      tokenizes to `कम` alone. JavaScript's `\w` is ASCII-only and would match nothing here.
 *   2. JavaScript's `\b` is ASCII-based, so the boundaries are emulated with lookaround
 *      over the same character class.
 */
const WORD_TOKEN_RE = /(?<![\p{L}\p{N}_])[\p{L}\p{N}_]{2,}(?![\p{L}\p{N}_])/gu;

/** sklearn collapses runs of 2+ whitespace before extracting char n-grams. */
const MULTI_WHITESPACE_RE = /\s\s+/g;

/**
 * Word n-grams, joined by a single space, matching sklearn's `_word_ngrams`.
 * @param {string} text cleaned document
 * @param {[number, number]} ngramRange inclusive [min, max]
 */
export function wordNgrams(text, [minN, maxN]) {
  const tokens = text.match(WORD_TOKEN_RE) ?? [];
  const out = [];
  for (let n = minN; n <= maxN; n += 1) {
    if (n === 1) {
      out.push(...tokens);
      continue;
    }
    for (let i = 0; i + n <= tokens.length; i += 1) {
      out.push(tokens.slice(i, i + n).join(' '));
    }
  }
  return out;
}

/**
 * Character n-grams over the whole document including spaces, matching sklearn's
 * `_char_ngrams` (note: `analyzer='char'`, not `char_wb`, so n-grams cross word boundaries).
 * @param {string} text cleaned document
 * @param {[number, number]} ngramRange inclusive [min, max]
 */
export function charNgrams(text, [minN, maxN]) {
  const doc = text.replace(MULTI_WHITESPACE_RE, ' ');
  const chars = Array.from(doc); // codepoint-safe
  const len = chars.length;
  const out = [];
  const upper = Math.min(maxN, len);
  for (let n = minN; n <= upper; n += 1) {
    for (let i = 0; i + n <= len; i += 1) {
      out.push(chars.slice(i, i + n).join(''));
    }
  }
  return out;
}

/**
 * Count in-vocabulary terms, weight by IDF, L2-normalise.
 * @returns {Map<number, number>} featureIndex -> value (sparse)
 */
function tfidfBlock(terms, vocabulary, idf) {
  const counts = new Map();
  for (const term of terms) {
    const index = vocabulary.get(term);
    if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
  }

  let sumSquares = 0;
  const values = new Map();
  for (const [index, count] of counts) {
    const value = count * idf[index];
    values.set(index, value);
    sumSquares += value * value;
  }

  // sklearn's normalize() leaves an all-zero row untouched rather than dividing by zero.
  const norm = Math.sqrt(sumSquares);
  if (norm > 0) {
    for (const [index, value] of values) values.set(index, value / norm);
  }
  return values;
}

export class TfidfVectorizer {
  /** @param {{word: object, char: object}} artifacts from `loadArtifacts()` */
  constructor({ word, char }) {
    this.word = word;
    this.char = char;
    this.charOffset = word.nFeatures;
    this.nFeatures = word.nFeatures + char.nFeatures;
  }

  /**
   * Transform one cleaned document into a sparse feature vector.
   * @param {string} cleanedText output of `preprocessor.clean()`
   * @returns {{indices: Int32Array, values: Float64Array}} ascending by index
   */
  transform(cleanedText) {
    const wordValues = tfidfBlock(
      wordNgrams(cleanedText, this.word.ngramRange),
      this.word.vocabulary,
      this.word.idf,
    );
    const charValues = tfidfBlock(
      charNgrams(cleanedText, this.char.ngramRange),
      this.char.vocabulary,
      this.char.idf,
    );

    const pairs = new Array(wordValues.size + charValues.size);
    let k = 0;
    for (const [index, value] of wordValues) pairs[k++] = [index, value];
    for (const [index, value] of charValues) pairs[k++] = [index + this.charOffset, value];
    pairs.sort((a, b) => a[0] - b[0]);

    const indices = new Int32Array(pairs.length);
    const values = new Float64Array(pairs.length);
    for (let i = 0; i < pairs.length; i += 1) {
      indices[i] = pairs[i][0];
      values[i] = pairs[i][1];
    }
    return { indices, values };
  }
}

export default { TfidfVectorizer, wordNgrams, charNgrams };

/**
 * TF-IDF fitting — the training-time counterpart to `services/tfidf.js`.
 *
 * Mirrors `sklearn.feature_extraction.text.TfidfVectorizer.fit`:
 *   1. extract n-grams from every document
 *   2. keep the top `maxFeatures` terms by corpus term frequency
 *   3. assign feature indices
 *   4. idf = ln((1 + nSamples) / (1 + df)) + 1        (smooth_idf=True)
 *
 * Two deliberate differences from sklearn, both safe because retrained weights are
 * regenerated as a matched set (vocabulary, idf and coefficients always ship together):
 *   - ties in the top-N selection break on the term itself rather than numpy's unstable
 *     quicksort, so training is reproducible run to run
 *   - indices are assigned in sorted term order rather than first-appearance order
 */
import { wordNgrams, charNgrams } from '../services/tfidf.js';

/**
 * @param {string[]} documents cleaned documents
 * @param {{analyzer: 'word'|'char', ngramRange: [number, number], maxFeatures: number}} options
 * @returns {{vocabulary: Map<string, number>, idf: Float64Array, nFeatures: number, ngramRange: [number, number]}}
 */
export function fitTfidf(documents, { analyzer, ngramRange, maxFeatures }) {
  const extract = analyzer === 'word' ? wordNgrams : charNgrams;

  const termFrequency = new Map(); // total occurrences across the corpus
  const documentFrequency = new Map(); // number of documents containing the term

  for (const doc of documents) {
    const terms = extract(doc, ngramRange);
    const seen = new Set();
    for (const term of terms) {
      termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
      if (!seen.has(term)) {
        seen.add(term);
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }
  }

  if (termFrequency.size === 0) {
    throw new Error('Empty vocabulary: no terms were extracted from the corpus.');
  }

  // Top-N by term frequency, ties broken lexicographically for reproducibility.
  const selected = [...termFrequency.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .slice(0, maxFeatures)
    .map(([term]) => term)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const vocabulary = new Map();
  selected.forEach((term, index) => vocabulary.set(term, index));

  const nSamples = documents.length;
  const idf = new Float64Array(selected.length);
  selected.forEach((term, index) => {
    const df = documentFrequency.get(term) ?? 0;
    idf[index] = Math.log((1 + nSamples) / (1 + df)) + 1;
  });

  return { vocabulary, idf, nFeatures: selected.length, ngramRange };
}

export default { fitTfidf };

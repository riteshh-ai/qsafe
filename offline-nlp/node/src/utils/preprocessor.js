/**
 * Text preprocessing & normalisation.
 *
 * Port of `offline-nlp/src/preprocessor.py::TextPreprocessor.clean`. Every step and its
 * order is load-bearing: the fitted TF-IDF vocabularies were built on the output of this
 * exact pipeline, so any divergence silently changes which features fire.
 *
 * Supports English, Devanagari Nepali (U+0900–U+097F) and Romanized Nepali.
 */

/**
 * Emergency emoji → semantic text, applied before punctuation is stripped so the signal
 * survives. Insertion order matches the Python dict (duplicate "🌊" collapses to one entry
 * in both languages, with the same value, so iteration order is equivalent).
 */
export const EMOJI_MAP = Object.freeze({
  '🚨': ' emergency ',
  '🚑': ' ambulance ',
  '🔥': ' fire ',
  '🩸': ' bleeding ',
  '🤕': ' injury ',
  '🏥': ' hospital ',
  '🆘': ' help ',
  '🌊': ' flood ',
  '🏚': ' collapse ',
  '⚠️': ' warning ',
  '💊': ' medicine ',
  '🌍': ' earthquake ',
  '🌋': ' earthquake ',
});

/**
 * Python's `\s` for `str`, spelled out.
 *
 * JavaScript's `\s` additionally matches U+FEFF (BOM) while Python's does not, so relying
 * on `\s` here would keep a BOM as a space where Python deletes it outright. The explicit
 * class removes that divergence.
 */
const PY_SPACE_CLASS =
  '\\t\\n\\v\\f\\r \\u001c\\u001d\\u001e\\u001f\\u0085\\u00a0\\u1680' +
  '\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';

/** Retain only: Latin a-z, digits, Devanagari, and whitespace. Everything else is noise. */
const NOISE_RE = new RegExp(`[^a-z0-9\\u0900-\\u097F${PY_SPACE_CLASS}]`, 'gu');
const WHITESPACE_RUN_RE = new RegExp(`[${PY_SPACE_CLASS}]+`, 'gu');
const WHITESPACE_TRIM_RE = new RegExp(`^[${PY_SPACE_CLASS}]+|[${PY_SPACE_CLASS}]+$`, 'gu');

/**
 * Normalise raw user input for feature extraction.
 *
 * Tolerates null/undefined/non-string input (the HTTP layer can hand us a JSON null).
 *
 * @param {unknown} text raw input
 * @returns {string} cleaned text, or "" when the input is unusable
 */
export function clean(text) {
  if (typeof text !== 'string') return '';
  if (text.replace(WHITESPACE_TRIM_RE, '') === '') return '';

  let out = text.normalize('NFC');

  for (const [emoji, semantic] of Object.entries(EMOJI_MAP)) {
    if (out.includes(emoji)) out = out.replaceAll(emoji, semantic);
  }

  out = out.toLowerCase();
  out = out.replace(NOISE_RE, '');
  out = out.replace(WHITESPACE_RUN_RE, ' ');
  return out.replace(WHITESPACE_TRIM_RE, '');
}

export default { clean, EMOJI_MAP };

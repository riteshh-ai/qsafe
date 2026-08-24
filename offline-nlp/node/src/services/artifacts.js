/**
 * Loads the exported model artifacts.
 *
 * Replaces `offline-nlp/src/model.py::ModelTrainer.load_model`, which unpickled
 * `.joblib` files. Those are Python-only; `scripts/export_artifacts.py` lifted the fitted
 * weights into a portable JSON + float64 binary pair that loads here with no Python
 * involved.
 *
 * weights.bin is one contiguous little-endian float64 blob; `classifier.json.layout`
 * gives the offset/length of each array inside it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACTS_DIR = path.resolve(__dirname, '../../artifacts');

/** Node's Float64Array is platform-endian; every supported target is little-endian. */
function assertLittleEndian() {
  const probe = new Uint8Array(new Uint16Array([1]).buffer);
  if (probe[0] !== 1) {
    throw new Error('Big-endian platform: weights.bin is little-endian and needs byte swapping.');
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, file), 'utf8'));
}

/**
 * @returns {{
 *   word: {vocabulary: Map<string, number>, ngramRange: [number, number], idf: Float64Array, nFeatures: number},
 *   char: {vocabulary: Map<string, number>, ngramRange: [number, number], idf: Float64Array, nFeatures: number},
 *   classifier: {classes: string[], nClasses: number, nFeatures: number, coef: Float64Array, intercept: Float64Array}
 * }}
 */
export function loadArtifacts() {
  assertLittleEndian();

  const vectorizer = readJson('vectorizer.json');
  const classifier = readJson('classifier.json');

  if (classifier.dtype !== 'float64' || classifier.byteOrder !== 'little') {
    throw new Error(`Unsupported artifact encoding: ${classifier.dtype}/${classifier.byteOrder}`);
  }

  const raw = fs.readFileSync(path.join(ARTIFACTS_DIR, 'weights.bin'));
  // Copy rather than view: fs.readFileSync may return a Buffer whose byteOffset is not
  // 8-byte aligned, which Float64Array cannot wrap.
  const blob = new Float64Array(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  );

  const slice = (key) => {
    const spec = classifier.layout[key];
    if (!spec) throw new Error(`weights.bin layout is missing "${key}"`);
    return blob.subarray(spec.offset, spec.offset + spec.length);
  };

  const wordIdf = slice('wordIdf');
  const charIdf = slice('charIdf');
  const coef = slice('coef');
  const intercept = slice('intercept');

  const expected = classifier.nClasses * classifier.nFeatures;
  if (coef.length !== expected) {
    throw new Error(`coef length ${coef.length} != nClasses*nFeatures ${expected}`);
  }
  if (wordIdf.length + charIdf.length !== classifier.nFeatures) {
    throw new Error('word+char idf lengths do not sum to nFeatures');
  }

  return {
    word: {
      vocabulary: new Map(Object.entries(vectorizer.word.vocabulary)),
      ngramRange: vectorizer.word.ngramRange,
      nFeatures: vectorizer.word.nFeatures,
      idf: wordIdf,
    },
    char: {
      vocabulary: new Map(Object.entries(vectorizer.char.vocabulary)),
      ngramRange: vectorizer.char.ngramRange,
      nFeatures: vectorizer.char.nFeatures,
      idf: charIdf,
    },
    classifier: {
      classes: classifier.classes,
      nClasses: classifier.nClasses,
      nFeatures: classifier.nFeatures,
      coef,
      intercept,
    },
  };
}

export default { loadArtifacts, ARTIFACTS_DIR };

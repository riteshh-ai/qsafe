/**
 * Real-time offline intent classification engine.
 *
 * Port of `offline-nlp/src/engine.py::IntentEngine`, preserving the cascading tiers and
 * their exact precedence:
 *
 *   Tier 1a  exact keyword match          confidence 1.00   source "keyword"
 *   Tier 1b  high-signal phrase rule      confidence 0.98   source "keyword"
 *   Tier 1c  fuzzy keyword (cutoff 0.85)  confidence 0.95   source "keyword_fuzzy"
 *   Tier 2   TF-IDF + logistic regression                   source "ml"
 *   Tier 3   threshold guard (tau = 0.25) -> fallback_unclear, source "fallback"
 *
 * Tier order is load-bearing: an exact hit must never be overridden by the classifier.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

import { clean } from '../utils/preprocessor.js';
import { getCloseMatches } from '../utils/difflib.js';
import { loadArtifacts } from './artifacts.js';
import { TfidfVectorizer } from './tfidf.js';
import { LogisticRegressionClassifier } from './logreg.js';
import { PHRASE_RULES, ACTION_MAP, URGENCY_KEYWORDS, LOCATIONS } from './phraseRules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '../../..');

/**
 * Python's `\d` is Unicode-aware and matches Devanagari digits; JS `\d` is ASCII-only.
 * Alternation order is kept exactly as in the Python source — regex alternation is
 * leftmost-first in both languages, so reordering would change which branch matches.
 */
const HEADCOUNT_RE =
  /(\p{Nd}+)\s*(people|injured|dead|stuck|trapped|jana|jana ghaite)/iu;

/** Python's `re.escape` covers more than JS needs, but over-escaping is harmless. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LATIN_PHRASE_RE = /^[a-z0-9 ]+$/;

export class IntentEngine {
  static CONFIDENCE_THRESHOLD = 0.25;
  static FALLBACK_INTENT = 'fallback_unclear';

  /** @param {string} [projectRoot] path to the `offline-nlp` directory */
  constructor(projectRoot = DEFAULT_PROJECT_ROOT) {
    this.projectRoot = projectRoot;

    this.keywords = this.#loadKeywords();
    this.phraseRules = PHRASE_RULES.map(([intent, phrases]) => [
      intent,
      phrases.map((phrase) => clean(phrase)),
    ]);

    const artifacts = loadArtifacts();
    this.vectorizer = new TfidfVectorizer(artifacts);
    this.classifier = new LogisticRegressionClassifier(artifacts.classifier);
  }

  /**
   * Load the keyword → intent dictionary from `datasets/keywords.csv`.
   * Keywords are normalised through the same preprocessor as user input.
   * @returns {Map<string, string>}
   */
  #loadKeywords() {
    const keywordsPath = path.join(this.projectRoot, 'datasets', 'keywords.csv');
    if (!fs.existsSync(keywordsPath)) {
      throw new Error(`Keywords file not found: ${keywordsPath}`);
    }

    const rows = parse(fs.readFileSync(keywordsPath, 'utf8'), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });

    const keywords = new Map();
    for (const row of rows) {
      const keyword = clean(row.keyword);
      // Later duplicates overwrite earlier ones, matching Python dict assignment.
      if (keyword) keywords.set(keyword, row.intent);
    }
    return keywords;
  }

  /**
   * Classify input text through the cascading tiers.
   *
   * @param {unknown} text raw user input; null/non-string is tolerated
   * @returns {{intent: string, confidence: number, source: string, urgency: string,
   *            entities: object, recommended_action: string|null, latency_ms: number}}
   */
  predict(text) {
    const start = process.hrtime.bigint();
    const elapsedMs = () => Number(process.hrtime.bigint() - start) / 1e6;

    // Normalise non-string input before it reaches the raw-text helpers below.
    const raw = typeof text === 'string' ? text : '';
    const cleaned = clean(raw);

    const result = {
      intent: IntentEngine.FALLBACK_INTENT,
      confidence: 0.0,
      source: 'fallback',
      urgency: this.#detectUrgency(raw, cleaned),
      entities: this.#extractEntities(raw),
      recommended_action: null,
      latency_ms: 0.0,
    };

    const finish = (intent, confidence, source) => {
      result.intent = intent;
      result.confidence = confidence;
      result.source = source;
      result.recommended_action = ACTION_MAP[intent] ?? null;
      result.latency_ms = round2(elapsedMs());
      return result;
    };

    // Tier 1a: exact keyword match
    const exact = this.keywords.get(cleaned);
    if (exact !== undefined) return finish(exact, 1.0, 'keyword');

    // Tier 1b: high-signal phrase inside a longer field message
    const phraseIntent = this.#matchPhraseRule(cleaned);
    if (phraseIntent) return finish(phraseIntent, 0.98, 'keyword');

    // Tier 1c: fuzzy keyword match for severe typos
    const [closest] = getCloseMatches(cleaned, this.keywords.keys(), 1, 0.85);
    if (closest !== undefined) {
      return finish(this.keywords.get(closest), 0.95, 'keyword_fuzzy');
    }

    // Tier 2: ML classification
    try {
      const sparse = this.vectorizer.transform(cleaned);
      const { intent, confidence } = this.classifier.predict(sparse);

      result.confidence = round4(confidence);
      // Tier 3: confidence threshold guardrail. Below tau the argmax is discarded and
      // the result stays `fallback_unclear` / "fallback" rather than guessing.
      if (confidence >= IntentEngine.CONFIDENCE_THRESHOLD) {
        result.intent = intent;
        result.source = 'ml';
        result.recommended_action = ACTION_MAP[intent] ?? null;
      }
      result.latency_ms = round2(elapsedMs());
      return result;
    } catch (error) {
      result.error = error.message;
      result.latency_ms = round2(elapsedMs());
      return result;
    }
  }

  /** @param {string[]} texts */
  batchPredict(texts) {
    return texts.map((text) => this.predict(text));
  }

  /** First ordered phrase rule contained in `cleaned`, or null. */
  #matchPhraseRule(cleaned) {
    if (!cleaned) return null;
    for (const [intent, phrases] of this.phraseRules) {
      for (const phrase of phrases) {
        if (phrase && containsPhrase(cleaned, phrase)) return intent;
      }
    }
    return null;
  }

  /** Heuristic urgency from punctuation and strong keywords. */
  #detectUrgency(rawText, cleanedText) {
    if (rawText.includes('!') || isUpper(rawText)) return 'HIGH';
    for (const keyword of URGENCY_KEYWORDS) {
      if (cleanedText.includes(keyword)) return 'HIGH';
    }
    return 'LOW';
  }

  /** Lightweight entity extraction over the RAW text (not the cleaned form). */
  #extractEntities(text) {
    const entities = {};

    const headcount = HEADCOUNT_RE.exec(text);
    if (headcount) entities.headcount = headcount[1];

    const lower = text.toLowerCase();
    const location = LOCATIONS.find((loc) => lower.includes(loc));
    if (location !== undefined) entities.location = location;

    return entities;
  }
}

/**
 * Latin phrases match on token boundaries; script phrases match by containment.
 * Port of `IntentEngine._contains_phrase`.
 */
export function containsPhrase(cleanedText, phrase) {
  if (LATIN_PHRASE_RE.test(phrase)) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(phrase)}(?![a-z0-9])`, 'u');
    return pattern.test(cleanedText);
  }
  return cleanedText.includes(phrase);
}

/**
 * Python's `str.isupper()`: true when there is at least one cased character and every
 * cased character is uppercase. Devanagari is caseless, so pure Nepali text is false.
 */
function isUpper(text) {
  return text !== text.toLowerCase() && text === text.toUpperCase();
}

/** Python's `round(x, 2)` on a positive float. */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/** Python's `round(x, 4)` on a positive float. */
function round4(value) {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Singleton, mirroring `engine.py::get_engine`. Loading the 3 MB weight blob and
// building the vocab maps costs ~100 ms, so it happens once per process.
// ---------------------------------------------------------------------------
let engineInstance = null;

/**
 * @param {string} [projectRoot]
 * @returns {IntentEngine}
 */
export function getEngine(projectRoot) {
  if (engineInstance === null) engineInstance = new IntentEngine(projectRoot);
  return engineInstance;
}

/** Test helper: drop the cached singleton. */
export function resetEngine() {
  engineInstance = null;
}

export default { IntentEngine, getEngine, resetEngine, containsPhrase };

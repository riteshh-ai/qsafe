#!/usr/bin/env node
/**
 * Train, evaluate and validate the intent model, writing every artifact into one
 * directory (`offline-nlp/metrics/` by default).
 *
 * Protocol - the validation split is never used to make a decision, only to report:
 *
 *   1. split `train` into fit (85%) / dev (15%), stratified by intent, seeded
 *   2. sweep C on dev to select regularisation strength
 *   3. retrain on the FULL train split with the selected C
 *   4. report on the untouched `validation` split
 *   5. probe on the 40-query curated sets (eval_dataset.json, validation_dataset.json)
 *
 * Selecting hyperparameters on the same split you report is the usual way these numbers
 * get quietly inflated, which is why the dev slice exists.
 *
 *   node scripts/report.js [--out DIR] [--deploy] [--quick]
 *
 * `--deploy` overwrites `artifacts/` with the newly trained model. Without it the
 * candidate is written under the metrics directory and production is left alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'csv-parse/sync';

import { clean } from '../src/utils/preprocessor.js';
import { fitTfidf } from '../src/training/tfidfFit.js';
import { trainLogisticRegression } from '../src/training/logregTrain.js';
import { TfidfVectorizer } from '../src/services/tfidf.js';
import { LogisticRegressionClassifier } from '../src/services/logreg.js';
import { IntentEngine } from '../src/services/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(NODE_ROOT, '..');

const WORD_CONFIG = { analyzer: 'word', ngramRange: [1, 2], maxFeatures: 5000 };
const CHAR_CONFIG = { analyzer: 'char', ngramRange: [2, 5], maxFeatures: 10000 };
const C_GRID = [0.25, 0.5, 1.0, 2.0, 5.0];
const TAU_GRID = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];

/** Deterministic PRNG so the fit/dev split is reproducible run to run. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Cluster near-duplicate rows via union-find over char 4-gram Jaccard similarity.
 *
 * This dataset is template-generated with injected typos: 42% of train rows have a
 * >=0.80-similar twin elsewhere in train ("my brother collapsed and not waking up" vs
 * "my brother collapsed and nto waking up"). A dev slice carved at random therefore leaves
 * each held-out row's near-twin in the fit set, so dev measures memorisation and selects
 * the least-regularised model. Splitting by cluster instead of by row removes that.
 */
function groupNearDuplicates(rows, threshold = 0.8, n = 4) {
  const grams = rows.map((r) => {
    const set = new Set();
    const chars = [...r.cleaned];
    for (let i = 0; i + n <= chars.length; i += 1) set.add(chars.slice(i, i + n).join(''));
    return set;
  });

  const parent = rows.map((_, i) => i);
  const find = (x) => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    while (parent[x] !== root) {
      const next = parent[x];
      parent[x] = root;
      x = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const index = new Map();
  grams.forEach((set, i) => {
    for (const g of set) {
      if (!index.has(g)) index.set(g, []);
      index.get(g).push(i);
    }
  });

  for (let i = 0; i < rows.length; i += 1) {
    if (grams[i].size === 0) continue;
    const shared = new Map();
    for (const g of grams[i]) {
      for (const j of index.get(g)) {
        if (j > i) shared.set(j, (shared.get(j) ?? 0) + 1);
      }
    }
    for (const [j, count] of shared) {
      const jaccard = count / (grams[i].size + grams[j].size - count);
      if (jaccard >= threshold) union(i, j);
    }
  }

  const clusters = new Map();
  rows.forEach((_, i) => {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(i);
  });
  return [...clusters.values()];
}

/**
 * Stratified fit/dev split that keeps near-duplicate clusters intact.
 * Clusters are assigned whole, to the intent of their first member.
 */
function stratifiedSplit(rows, devFraction, seed) {
  const rng = makeRng(seed);
  const clusters = groupNearDuplicates(rows);

  const byIntent = new Map();
  for (const cluster of clusters) {
    const intent = rows[cluster[0]].intent;
    if (!byIntent.has(intent)) byIntent.set(intent, []);
    byIntent.get(intent).push(cluster);
  }

  const fit = [];
  const dev = [];
  for (const [, group] of [...byIntent.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const shuffled = [...group];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const targetDev = Math.max(1, Math.round(shuffled.length * devFraction));
    shuffled.forEach((cluster, i) => {
      const target = i < targetDev ? dev : fit;
      for (const idx of cluster) target.push(rows[idx]);
    });
  }
  return { fit, dev, clusterCount: clusters.length };
}

function buildModel(rows, classes, C, maxIterations) {
  const texts = rows.map((r) => r.cleaned);
  const word = fitTfidf(texts, WORD_CONFIG);
  const char = fitTfidf(texts, CHAR_CONFIG);
  const vectorizer = new TfidfVectorizer({ word, char });
  const classIndex = new Map(classes.map((c, i) => [c, i]));

  const X = texts.map((t) => vectorizer.transform(t));
  const y = rows.map((r) => classIndex.get(r.intent));

  const model = trainLogisticRegression(X, y, {
    nFeatures: vectorizer.nFeatures,
    nClasses: classes.length,
    C,
    maxIterations,
  });

  const classifier = new LogisticRegressionClassifier({
    classes,
    nClasses: classes.length,
    nFeatures: vectorizer.nFeatures,
    coef: model.coef,
    intercept: model.intercept,
  });

  return { word, char, vectorizer, classifier, model };
}

function scoreAll(yTrue, yPred, classes) {
  let correct = 0;
  for (let i = 0; i < yTrue.length; i += 1) if (yTrue[i] === yPred[i]) correct += 1;

  const perClass = classes.map((cls) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (let i = 0; i < yTrue.length; i += 1) {
      if (yPred[i] === cls && yTrue[i] === cls) tp += 1;
      else if (yPred[i] === cls) fp += 1;
      else if (yTrue[i] === cls) fn += 1;
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { intent: cls, support: tp + fn, tp, fp, fn, precision, recall, f1 };
  });

  const n = classes.length;
  const weightTotal = perClass.reduce((a, c) => a + c.support, 0) || 1;
  return {
    accuracy: correct / yTrue.length,
    macroPrecision: perClass.reduce((a, c) => a + c.precision, 0) / n,
    macroRecall: perClass.reduce((a, c) => a + c.recall, 0) / n,
    macroF1: perClass.reduce((a, c) => a + c.f1, 0) / n,
    weightedF1: perClass.reduce((a, c) => a + c.f1 * c.support, 0) / weightTotal,
    perClass,
  };
}

/** Wilson score interval - honest error bars on a proportion at this sample size. */
function wilson(correct, total, z = 1.96) {
  if (total === 0) return [0, 0];
  const p = correct / total;
  const d = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [(centre - spread) / d, (centre + spread) / d];
}

function confusionMatrix(yTrue, yPred, classes) {
  const idx = new Map(classes.map((c, i) => [c, i]));
  const m = classes.map(() => new Array(classes.length).fill(0));
  for (let i = 0; i < yTrue.length; i += 1) {
    const r = idx.get(yTrue[i]);
    const c = idx.get(yPred[i]);
    if (r !== undefined && c !== undefined) m[r][c] += 1;
  }
  return m;
}

/** Row-normalised confusion heatmap as standalone SVG (no plotting library needed). */
function confusionSvg(matrix, classes, title) {
  const cell = 22;
  const left = 210;
  const top = 210;
  const pad = 24;
  const size = classes.length * cell;
  const width = left + size + pad + 90;
  const height = top + size + pad;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-sans-serif,system-ui,sans-serif">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    `<text x="${left}" y="24" font-size="15" font-weight="600" fill="#111">${esc(title)}</text>`,
    `<text x="${left}" y="42" font-size="11" fill="#666">rows = true intent, columns = predicted, shading = share of the true class</text>`,
  ];

  classes.forEach((c, i) => {
    const y = top + i * cell + cell * 0.7;
    parts.push(`<text x="${left - 8}" y="${y}" font-size="10" text-anchor="end" fill="#333">${esc(c)}</text>`);
    const x = left + i * cell + cell * 0.7;
    parts.push(`<text x="${x}" y="${top - 8}" font-size="10" text-anchor="start" fill="#333" transform="rotate(-90 ${x} ${top - 8})">${esc(c)}</text>`);
  });

  matrix.forEach((row, i) => {
    const total = row.reduce((a, b) => a + b, 0) || 1;
    row.forEach((v, j) => {
      const frac = v / total;
      const x = left + j * cell;
      const y = top + i * cell;
      // Diagonal in green, off-diagonal errors in red, intensity by share.
      const hue = i === j ? '142 72% 35%' : '0 74% 48%';
      const fill = frac === 0 ? '#f7f7f7' : `hsl(${hue} / ${(0.12 + 0.88 * frac).toFixed(3)})`;
      parts.push(`<rect x="${x}" y="${y}" width="${cell - 1}" height="${cell - 1}" fill="${fill}"/>`);
      if (v > 0) {
        const dark = frac > 0.5;
        parts.push(`<text x="${x + cell / 2}" y="${y + cell / 2 + 3.5}" font-size="9" text-anchor="middle" fill="${dark ? '#fff' : '#333'}">${v}</text>`);
      }
    });
    const acc = row[i] / total;
    parts.push(`<text x="${left + size + 10}" y="${top + i * cell + cell * 0.7}" font-size="10" fill="#111">${(acc * 100).toFixed(0)}%</text>`);
  });
  parts.push(`<text x="${left + size + 10}" y="${top - 8}" font-size="10" fill="#666">recall</text>`);
  parts.push('</svg>');
  return parts.join('\n');
}

const csv = (rowsOut) =>
  rowsOut
    .map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(','))
    .join('\n') + '\n';

const pct = (x) => `${(x * 100).toFixed(2)}%`;

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: path.join(PROJECT_ROOT, 'metrics') },
      deploy: { type: 'boolean', default: false },
      quick: { type: 'boolean', default: false },
      seed: { type: 'string', default: '42' },
    },
  });

  const sweepIters = values.quick ? 80 : 150;
  const finalIters = values.quick ? 120 : 400;
  const outDir = values.out;

  const raw = parse(
    fs.readFileSync(path.join(PROJECT_ROOT, 'datasets', 'training_dataset.csv'), 'utf8'),
    { columns: true, skip_empty_lines: true, bom: true },
  );
  const rows = raw
    .map((r) => ({ text: r.text, intent: r.intent, split: r.split, cleaned: clean(r.text) }))
    .filter((r) => r.cleaned);

  const train = rows.filter((r) => r.split === 'train');
  const validation = rows.filter((r) => r.split === 'validation');
  const classes = [...new Set(train.map((r) => r.intent))].sort();

  console.log('='.repeat(76));
  console.log('QSAFE Offline NLU - train / evaluate / validate');
  console.log('='.repeat(76));
  console.log(`train ${train.length}  validation ${validation.length}  classes ${classes.length}`);

  // --- 1-2. hyperparameter selection on a dev slice carved out of train -----
  const { fit, dev, clusterCount } = stratifiedSplit(train, 0.15, Number.parseInt(values.seed, 10));
  console.log(`\n[1/4] Hyperparameter search  (fit ${fit.length} / dev ${dev.length}, seed ${values.seed})`);
  console.log(`   ${train.length} train rows collapse to ${clusterCount} near-duplicate clusters;`);
  console.log(`   clusters are assigned whole so no dev row has a twin left in fit.`);

  const search = [];
  for (const C of C_GRID) {
    const t0 = Date.now();
    const built = buildModel(fit, classes, C, sweepIters);
    const yPred = dev.map((r) => built.classifier.predict(built.vectorizer.transform(r.cleaned)).intent);
    const s = scoreAll(dev.map((r) => r.intent), yPred, classes);
    search.push({ C, accuracy: s.accuracy, macroF1: s.macroF1, seconds: (Date.now() - t0) / 1000 });
    console.log(`   C=${String(C).padEnd(5)} dev accuracy ${pct(s.accuracy)}  macro-F1 ${pct(s.macroF1)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  const best = search.reduce((a, b) => (b.macroF1 > a.macroF1 ? b : a));
  console.log(`   -> selected C=${best.C} (best dev macro-F1)`);

  // --- 3. retrain on the full train split ----------------------------------
  console.log(`\n[2/4] Retraining on the full train split with C=${best.C}...`);
  const t0 = Date.now();
  const final = buildModel(train, classes, best.C, finalIters);
  console.log(`   ${final.model.converged ? 'converged' : 'stopped'} after ${final.model.iterations} iterations (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

  // --- 4. report on the untouched validation split -------------------------
  console.log('\n[3/4] Evaluating on the untouched validation split...');
  const yTrue = validation.map((r) => r.intent);
  const mlRaw = validation.map((r) => final.classifier.predict(final.vectorizer.transform(r.cleaned)));

  const tauRows = [['tau', 'coverage', 'accuracy_on_covered', 'overall_accuracy', 'macro_f1']];
  let bestTau = { tau: 0.25, macroF1: -1 };
  for (const tau of TAU_GRID) {
    const yPred = mlRaw.map((p) => (p.confidence >= tau ? p.intent : 'fallback_unclear'));
    const s = scoreAll(yTrue, yPred, classes);
    const covered = mlRaw.filter((p) => p.confidence >= tau).length;
    let coveredCorrect = 0;
    mlRaw.forEach((p, i) => {
      if (p.confidence >= tau && p.intent === yTrue[i]) coveredCorrect += 1;
    });
    tauRows.push([
      tau,
      (covered / mlRaw.length).toFixed(4),
      covered ? (coveredCorrect / covered).toFixed(4) : '',
      s.accuracy.toFixed(4),
      s.macroF1.toFixed(4),
    ]);
    if (s.macroF1 > bestTau.macroF1) bestTau = { tau, macroF1: s.macroF1 };
  }

  const TAU = IntentEngine.CONFIDENCE_THRESHOLD;
  const yPredMl = mlRaw.map((p) => (p.confidence >= TAU ? p.intent : 'fallback_unclear'));
  const mlScores = scoreAll(yTrue, yPredMl, classes);

  // full engine, using the newly trained model behind the existing rule tiers
  const engine = new IntentEngine();
  engine.vectorizer = final.vectorizer;
  engine.classifier = final.classifier;
  const fullPred = validation.map((r) => engine.predict(r.text));
  const fullScores = scoreAll(yTrue, fullPred.map((p) => p.intent), classes);

  const fullCorrect = Math.round(fullScores.accuracy * yTrue.length);
  const [lo, hi] = wilson(fullCorrect, yTrue.length);

  console.log(`   full engine  accuracy ${pct(fullScores.accuracy)}  (95% CI ${pct(lo)}-${pct(hi)})  macro-F1 ${pct(fullScores.macroF1)}`);
  console.log(`   ML tier only accuracy ${pct(mlScores.accuracy)}  macro-F1 ${pct(mlScores.macroF1)}`);

  // --- 5. real-world held-out set ------------------------------------------
  // The most honest number available. training_dataset.csv is template-generated with
  // injected typos, and the validation split is drawn from that same pool, so it shares
  // the templates. real_world_queries.csv is separately authored - but 46% of it happens
  // to overlap the train split exactly, so the overlap is excluded to leave genuinely
  // unseen phrasing.
  let realWorld = null;
  const rwPath = path.join(PROJECT_ROOT, 'datasets', 'real_world_queries.csv');
  if (fs.existsSync(rwPath)) {
    const trainCleaned = new Set(train.map((r) => r.cleaned));
    const rwRows = parse(fs.readFileSync(rwPath, 'utf8'), { columns: true, skip_empty_lines: true, bom: true })
      .map((r) => ({ text: r.text, intent: r.intent, cleaned: clean(r.text) }))
      .filter((r) => r.cleaned);

    const unseen = rwRows.filter((r) => !trainCleaned.has(r.cleaned));
    const scoreSet = (set) => {
      const yt = set.map((r) => r.intent);
      const yp = set.map((r) => engine.predict(r.text).intent);
      return scoreAll(yt, yp, classes);
    };
    const all = scoreSet(rwRows);
    const held = scoreSet(unseen);
    const [rlo, rhi] = wilson(Math.round(held.accuracy * unseen.length), unseen.length);

    realWorld = {
      totalRows: rwRows.length,
      overlappingTrain: rwRows.length - unseen.length,
      unseenRows: unseen.length,
      allRows: { accuracy: all.accuracy, macroF1: all.macroF1 },
      unseenOnly: { accuracy: held.accuracy, accuracyCI95: [rlo, rhi], macroF1: held.macroF1, perClass: held.perClass },
    };
    console.log(`   real-world set             ${pct(all.accuracy)} over ${rwRows.length} rows`);
    console.log(`   real-world, unseen only    ${pct(held.accuracy)} over ${unseen.length} rows  <- most honest estimate`);
  }

  // --- 6. curated 40-query probes ------------------------------------------
  const probes = {};
  for (const name of ['eval_dataset.json', 'validation_dataset.json']) {
    const p = path.join(PROJECT_ROOT, name);
    if (!fs.existsSync(p)) continue;
    const items = JSON.parse(fs.readFileSync(p, 'utf8'));
    let ok = 0;
    const misses = [];
    for (const item of items) {
      const got = engine.predict(item.query).intent;
      if (got === item.expected_intent) ok += 1;
      else misses.push({ query: item.query, expected: item.expected_intent, got });
    }
    probes[name] = { total: items.length, correct: ok, accuracy: ok / items.length, misses };
    console.log(`   ${name.padEnd(26)} ${ok}/${items.length}  ${pct(ok / items.length)}`);
  }

  // --- write everything ----------------------------------------------------
  console.log(`\n[4/4] Writing artifacts to ${outDir}`);
  fs.mkdirSync(outDir, { recursive: true });

  const matrix = confusionMatrix(yTrue, fullPred.map((p) => p.intent), classes);
  fs.writeFileSync(
    path.join(outDir, 'confusion_matrix.csv'),
    csv([['true\\predicted', ...classes], ...matrix.map((r, i) => [classes[i], ...r])]),
  );
  fs.writeFileSync(
    path.join(outDir, 'confusion_matrix.svg'),
    confusionSvg(matrix, classes, 'QSAFE intent confusion - validation split (full engine)'),
  );
  fs.writeFileSync(
    path.join(outDir, 'per_class.csv'),
    csv([
      ['intent', 'support', 'tp', 'fp', 'fn', 'precision', 'recall', 'f1'],
      ...[...fullScores.perClass]
        .sort((a, b) => a.f1 - b.f1)
        .map((c) => [c.intent, c.support, c.tp, c.fp, c.fn, c.precision.toFixed(4), c.recall.toFixed(4), c.f1.toFixed(4)]),
    ]),
  );
  fs.writeFileSync(path.join(outDir, 'threshold_sweep.csv'), csv(tauRows));
  fs.writeFileSync(
    path.join(outDir, 'hyperparameter_search.csv'),
    csv([['C', 'dev_accuracy', 'dev_macro_f1', 'seconds'], ...search.map((s) => [s.C, s.accuracy.toFixed(4), s.macroF1.toFixed(4), s.seconds.toFixed(1)])]),
  );

  const errorRows = [['text', 'expected', 'predicted', 'tier', 'confidence']];
  validation.forEach((r, i) => {
    if (fullPred[i].intent !== r.intent) {
      errorRows.push([r.text, r.intent, fullPred[i].intent, fullPred[i].source, fullPred[i].confidence]);
    }
  });
  fs.writeFileSync(path.join(outDir, 'errors.csv'), csv(errorRows));

  const tierStats = {};
  fullPred.forEach((p, i) => {
    tierStats[p.source] ??= { rows: 0, correct: 0 };
    tierStats[p.source].rows += 1;
    if (p.intent === yTrue[i]) tierStats[p.source].correct += 1;
  });
  for (const k of Object.keys(tierStats)) {
    tierStats[k].accuracy = tierStats[k].correct / tierStats[k].rows;
    tierStats[k].share = tierStats[k].rows / yTrue.length;
  }

  const metrics = {
    generatedBy: 'offline-nlp/node/scripts/report.js',
    runtime: `node ${process.version}`,
    protocol: {
      hyperparameterSelection: 'stratified 85/15 fit-dev split carved from the train split',
      seed: Number.parseInt(values.seed, 10),
      reportedOn: 'validation split, untouched during selection',
      note: 'The validation split is never used to choose anything, only to report.',
    },
    dataset: { train: train.length, validation: validation.length, classes: classes.length },
    hyperparameters: { C: best.C, solver: 'lbfgs', maxIterations: finalIters, confidenceThreshold: TAU },
    hyperparameterSearch: search,
    training: { converged: final.model.converged, iterations: final.model.iterations, loss: final.model.loss },
    validation: {
      fullEngine: {
        accuracy: fullScores.accuracy,
        accuracyCI95: [lo, hi],
        macroPrecision: fullScores.macroPrecision,
        macroRecall: fullScores.macroRecall,
        macroF1: fullScores.macroF1,
        weightedF1: fullScores.weightedF1,
      },
      mlTierOnly: {
        accuracy: mlScores.accuracy,
        macroPrecision: mlScores.macroPrecision,
        macroRecall: mlScores.macroRecall,
        macroF1: mlScores.macroF1,
      },
      byTier: tierStats,
      perClass: fullScores.perClass,
      bestThresholdByMacroF1: bestTau,
    },
    realWorldHeldOut: realWorld,
    curatedProbes: probes,
    classes,
  };
  fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));

  // candidate model artifacts
  const modelDir = values.deploy ? path.join(NODE_ROOT, 'artifacts') : path.join(outDir, 'candidate-model');
  fs.mkdirSync(modelDir, { recursive: true });
  fs.writeFileSync(
    path.join(modelDir, 'vectorizer.json'),
    JSON.stringify({
      word: { vocabulary: Object.fromEntries(final.word.vocabulary), ngramRange: final.word.ngramRange, nFeatures: final.word.nFeatures },
      char: { vocabulary: Object.fromEntries(final.char.vocabulary), ngramRange: final.char.ngramRange, nFeatures: final.char.nFeatures },
    }),
  );
  const layout = {};
  let cursor = 0;
  for (const [k, arr] of [['wordIdf', final.word.idf], ['charIdf', final.char.idf], ['coef', final.model.coef], ['intercept', final.model.intercept]]) {
    layout[k] = { offset: cursor, length: arr.length };
    cursor += arr.length;
  }
  fs.writeFileSync(
    path.join(modelDir, 'classifier.json'),
    JSON.stringify({
      classes, nClasses: classes.length, nFeatures: final.vectorizer.nFeatures,
      dtype: 'float64', byteOrder: 'little', layout,
      trainedBy: 'node scripts/report.js', hyperparameters: { C: best.C, maxIterations: finalIters, solver: 'lbfgs' },
      validation: { accuracy: fullScores.accuracy, macroF1: fullScores.macroF1 },
    }, null, 1),
  );
  const blob = new Float64Array(cursor);
  blob.set(final.word.idf, layout.wordIdf.offset);
  blob.set(final.char.idf, layout.charIdf.offset);
  blob.set(final.model.coef, layout.coef.offset);
  blob.set(final.model.intercept, layout.intercept.offset);
  fs.writeFileSync(path.join(modelDir, 'weights.bin'), Buffer.from(blob.buffer));

  const worst = [...fullScores.perClass].sort((a, b) => a.f1 - b.f1).slice(0, 6);
  const confPairs = new Map();
  validation.forEach((r, i) => {
    if (fullPred[i].intent !== r.intent) {
      const k = `${r.intent} → ${fullPred[i].intent}`;
      confPairs.set(k, (confPairs.get(k) ?? 0) + 1);
    }
  });
  const topConf = [...confPairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  fs.writeFileSync(path.join(outDir, 'README.md'), `# QSAFE Offline NLU — model report

Generated by \`offline-nlp/node/scripts/report.js\` on node ${process.version}.
Regenerate with \`node scripts/report.js\` from \`offline-nlp/node\`.

## Protocol

Hyperparameters were selected on a stratified 85/15 fit/dev split carved out of the
**train** split (seed ${values.seed}). The **validation** split was never used to choose
anything — only to report. Selecting on the split you report is the usual way these
numbers get quietly inflated.

## Headline

| metric | full engine | ML tier only |
|---|---|---|
| accuracy | **${pct(fullScores.accuracy)}** | ${pct(mlScores.accuracy)} |
| macro precision | ${pct(fullScores.macroPrecision)} | ${pct(mlScores.macroPrecision)} |
| macro recall | ${pct(fullScores.macroRecall)} | ${pct(mlScores.macroRecall)} |
| macro F1 | ${pct(fullScores.macroF1)} | ${pct(mlScores.macroF1)} |
| weighted F1 | ${pct(fullScores.weightedF1)} | — |

Accuracy 95% confidence interval: **${pct(lo)} – ${pct(hi)}** (Wilson, n=${yTrue.length}).
At this sample size 1 percentage point is ${(yTrue.length / 100).toFixed(1)} rows, so
differences smaller than about 1.7 points are not statistically meaningful.

*Full engine* is what production does (keyword → phrase → fuzzy → ML → threshold guard).
*ML tier only* bypasses the keyword tiers and is the classifier's own generalisation.
The full-engine figure is optimistic on this dataset because \`keywords.csv\` was derived
from it.

## Selected hyperparameters

| | |
|---|---|
| C | ${best.C} |
| solver | lbfgs (strong-Wolfe line search) |
| iterations | ${final.model.iterations}${final.model.converged ? ' (converged)' : ' (hit cap)'} |
| confidence threshold τ | ${TAU} |
| features | 15,000 (word 1–2 gram ×5,000 + char 2–5 gram ×10,000) |

Search over C: ${search.map((s) => `${s.C}→${pct(s.macroF1)}`).join(', ')} (dev macro-F1).

## By tier

| tier | rows | share of traffic | accuracy |
|---|---|---|---|
${Object.entries(tierStats).sort().map(([k, v]) => `| \`${k}\` | ${v.rows} | ${pct(v.share)} | ${pct(v.accuracy)} |`).join('\n')}

## Weakest classes

| intent | support | precision | recall | F1 |
|---|---|---|---|---|
${worst.map((c) => `| \`${c.intent}\` | ${c.support} | ${pct(c.precision)} | ${pct(c.recall)} | ${pct(c.f1)} |`).join('\n')}

## Top confusions

| count | confusion |
|---|---|
${topConf.map(([k, v]) => `| ${v} | ${k} |`).join('\n')}

## Real-world held-out set — the honest number

${realWorld ? `| set | rows | accuracy | macro F1 |
|---|---|---|---|
| all real-world queries | ${realWorld.totalRows} | ${pct(realWorld.allRows.accuracy)} | ${pct(realWorld.allRows.macroF1)} |
| **unseen only** (train overlap removed) | **${realWorld.unseenRows}** | **${pct(realWorld.unseenOnly.accuracy)}** | ${pct(realWorld.unseenOnly.macroF1)} |

${realWorld.overlappingTrain} of ${realWorld.totalRows} real-world rows (${pct(realWorld.overlappingTrain / realWorld.totalRows)}) appear
verbatim in the train split, so on those the model is recalling memorised strings rather
than generalising. The unseen-only figure is the best available estimate of behaviour on
phrasing the model has never seen.

It is far below the validation-split number because \`training_dataset.csv\` is
template-generated with injected typos — 42% of train rows have a near-duplicate twin
inside train — and the validation split is drawn from that same pool, so it shares the
templates. **Treat the unseen-only figure, not the validation figure, as the number that
predicts field behaviour.**` : '_real_world_queries.csv not found_'}

## Curated probes

${Object.entries(probes).map(([k, v]) => `- \`${k}\` — ${v.correct}/${v.total} (${pct(v.accuracy)})`).join('\n') || '_none found_'}

## Files

| file | contents |
|---|---|
| \`metrics.json\` | every number in this report, machine-readable |
| \`confusion_matrix.csv\` | full ${classes.length}×${classes.length} matrix |
| \`confusion_matrix.svg\` | row-normalised heatmap |
| \`per_class.csv\` | per-intent P/R/F1, worst first |
| \`errors.csv\` | every misclassified validation row with tier and confidence |
| \`threshold_sweep.csv\` | coverage vs accuracy across τ |
| \`hyperparameter_search.csv\` | the C sweep on dev |
| \`candidate-model/\` | the trained weights (only when \`--deploy\` is not passed) |
`);

  console.log(`   metrics.json, confusion_matrix.{csv,svg}, per_class.csv, errors.csv,`);
  console.log(`   threshold_sweep.csv, hyperparameter_search.csv, README.md`);
  console.log(`   model -> ${modelDir}`);
  console.log('\n' + '='.repeat(76));
  console.log(`accuracy ${pct(fullScores.accuracy)} (95% CI ${pct(lo)}–${pct(hi)})   macro-F1 ${pct(fullScores.macroF1)}`);
  console.log('='.repeat(76));
  return 0;
}

process.exitCode = await main();

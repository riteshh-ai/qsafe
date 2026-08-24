#!/usr/bin/env node
/**
 * Train the intent classifier and write the artifacts the service loads.
 *
 * Replaces `python -m src.main train` (`offline-nlp/src/model.py::ModelTrainer`).
 *
 *   node scripts/train.js [--dataset PATH] [--out DIR] [--C 5.0] [--max-iter 1000]
 *
 * IMPORTANT: retraining produces new weights, which invalidates
 * `tests/fixtures/python-golden.json`. That fixture is the frozen record of the original
 * scikit-learn model's behaviour and is what `tests/parity.test.js` asserts against. After
 * a deliberate retrain, regenerate the fixture from the NEW model and review the diff —
 * do not silently overwrite it.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(NODE_ROOT, '..');

/** Hyperparameters carried over from the Python ModelTrainer. */
const WORD_CONFIG = { analyzer: 'word', ngramRange: [1, 2], maxFeatures: 5000 };
const CHAR_CONFIG = { analyzer: 'char', ngramRange: [2, 5], maxFeatures: 10000 };

function loadDataset(datasetPath) {
  const rows = parse(fs.readFileSync(datasetPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  for (const col of ['text', 'intent', 'split']) {
    if (!(col in rows[0])) throw new Error(`Dataset must contain a "${col}" column`);
  }

  const train = { texts: [], labels: [] };
  const validation = { texts: [], labels: [] };

  for (const row of rows) {
    const text = clean(row.text);
    if (!text) continue; // Python drops rows that preprocess to empty
    const bucket = row.split === 'validation' ? validation : row.split === 'train' ? train : null;
    if (!bucket) continue;
    bucket.texts.push(text);
    bucket.labels.push(row.intent);
  }

  return { train, validation };
}

function macroScores(yTrue, yPred, classes) {
  let correct = 0;
  for (let i = 0; i < yTrue.length; i += 1) if (yTrue[i] === yPred[i]) correct += 1;

  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;
  for (const cls of classes) {
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
    precisionSum += precision;
    recallSum += recall;
    f1Sum += f1;
  }

  const n = classes.length;
  return {
    accuracy: correct / yTrue.length,
    precision: precisionSum / n,
    recall: recallSum / n,
    f1: f1Sum / n,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      dataset: { type: 'string', default: path.join(PROJECT_ROOT, 'datasets', 'training_dataset.csv') },
      out: { type: 'string', default: path.join(NODE_ROOT, 'artifacts') },
      C: { type: 'string', default: '5.0' },
      'max-iter': { type: 'string', default: '1000' },
      quiet: { type: 'boolean', default: false },
    },
  });

  const C = Number.parseFloat(values.C);
  const maxIterations = Number.parseInt(values['max-iter'], 10);
  if (!Number.isFinite(C) || C <= 0) throw new Error(`--C must be a positive number`);
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error('--max-iter must be a positive integer');
  }

  console.log('='.repeat(70));
  console.log('QSafe Offline NLU - Training Pipeline (Node.js)');
  console.log('='.repeat(70));

  console.log('\nLoading dataset...');
  const { train, validation } = loadDataset(values.dataset);
  const classes = [...new Set(train.labels)].sort();
  const classIndex = new Map(classes.map((c, i) => [c, i]));
  console.log(`   ${train.texts.length} train / ${validation.texts.length} validation`);
  console.log(`   ${classes.length} intent classes`);

  console.log('\nFitting hybrid TF-IDF (word 1-2 grams + char 2-5 grams)...');
  const word = fitTfidf(train.texts, WORD_CONFIG);
  const char = fitTfidf(train.texts, CHAR_CONFIG);
  console.log(`   word features: ${word.nFeatures}`);
  console.log(`   char features: ${char.nFeatures}`);

  const vectorizer = new TfidfVectorizer({ word, char });
  const nFeatures = vectorizer.nFeatures;

  console.log('\nVectorising...');
  const XTrain = train.texts.map((t) => vectorizer.transform(t));
  const yTrain = train.labels.map((l) => classIndex.get(l));

  console.log(`\nTraining multinomial logistic regression (C=${C}, max_iter=${maxIterations})...`);
  const started = Date.now();
  const model = trainLogisticRegression(XTrain, yTrain, {
    nFeatures,
    nClasses: classes.length,
    C,
    maxIterations,
    verbose: !values.quiet,
  });
  console.log(
    `   ${model.converged ? 'converged' : 'stopped'} after ${model.iterations} iterations ` +
    `in ${((Date.now() - started) / 1000).toFixed(1)}s (loss ${model.loss.toFixed(6)})`,
  );

  console.log('\nEvaluating on the validation split...');
  const classifier = new LogisticRegressionClassifier({
    classes,
    nClasses: classes.length,
    nFeatures,
    coef: model.coef,
    intercept: model.intercept,
  });
  const predictions = validation.texts.map((t) => classifier.predict(vectorizer.transform(t)).intent);
  const scores = macroScores(validation.labels, predictions, classes);

  console.log(`   Accuracy  : ${(scores.accuracy * 100).toFixed(2)}%`);
  console.log(`   Precision : ${(scores.precision * 100).toFixed(2)}%  (macro)`);
  console.log(`   Recall    : ${(scores.recall * 100).toFixed(2)}%  (macro)`);
  console.log(`   F1-Score  : ${(scores.f1 * 100).toFixed(2)}%  (macro)`);

  console.log('\nWriting artifacts...');
  fs.mkdirSync(values.out, { recursive: true });

  fs.writeFileSync(
    path.join(values.out, 'vectorizer.json'),
    JSON.stringify({
      word: {
        vocabulary: Object.fromEntries(word.vocabulary),
        ngramRange: word.ngramRange,
        nFeatures: word.nFeatures,
      },
      char: {
        vocabulary: Object.fromEntries(char.vocabulary),
        ngramRange: char.ngramRange,
        nFeatures: char.nFeatures,
      },
    }),
    'utf8',
  );

  const layout = {};
  let cursor = 0;
  for (const [key, arr] of [
    ['wordIdf', word.idf],
    ['charIdf', char.idf],
    ['coef', model.coef],
    ['intercept', model.intercept],
  ]) {
    layout[key] = { offset: cursor, length: arr.length };
    cursor += arr.length;
  }

  fs.writeFileSync(
    path.join(values.out, 'classifier.json'),
    JSON.stringify(
      {
        classes,
        nClasses: classes.length,
        nFeatures,
        dtype: 'float64',
        byteOrder: 'little',
        layout,
        trainedBy: 'node scripts/train.js',
        hyperparameters: { C, maxIterations, solver: 'lbfgs' },
        validation: scores,
      },
      null,
      1,
    ),
    'utf8',
  );

  const blob = new Float64Array(cursor);
  blob.set(word.idf, layout.wordIdf.offset);
  blob.set(char.idf, layout.charIdf.offset);
  blob.set(model.coef, layout.coef.offset);
  blob.set(model.intercept, layout.intercept.offset);
  fs.writeFileSync(path.join(values.out, 'weights.bin'), Buffer.from(blob.buffer));

  console.log(`   ${path.join(values.out, 'vectorizer.json')}`);
  console.log(`   ${path.join(values.out, 'classifier.json')}`);
  console.log(`   ${path.join(values.out, 'weights.bin')} (${blob.byteLength.toLocaleString()} bytes)`);

  console.log('\n' + '='.repeat(70));
  console.log('Training complete.');
  console.log(
    'NOTE: these weights differ from the original scikit-learn model, so\n' +
    '      tests/fixtures/python-golden.json no longer describes this model.\n' +
    '      Regenerate it deliberately and review the diff before committing.',
  );
  console.log('='.repeat(70));
  return 0;
}

process.exitCode = await main();

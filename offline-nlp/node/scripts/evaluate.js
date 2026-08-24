#!/usr/bin/env node
/**
 * Evaluate the intent engine on a held-out split.
 *
 * Replaces the archived Python reporting scripts. Reports two different things, because
 * they answer different questions:
 *
 *   full engine  - what production actually does (keyword -> phrase -> fuzzy -> ML -> guard).
 *                  Optimistic on this dataset: keywords.csv was derived from it, so exact
 *                  hits are partly memorised. Still the number that reflects real behaviour.
 *   ML tier only - the classifier's own generalisation, with the keyword tiers bypassed.
 *                  This is the honest measure of model quality.
 *
 *   node scripts/evaluate.js [--dataset PATH] [--split validation] [--sweep]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'csv-parse/sync';

import { IntentEngine } from '../src/services/engine.js';
import { clean } from '../src/utils/preprocessor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function pad(v, w) {
  const s = String(v);
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}
function padStart(v, w) {
  const s = String(v);
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}
const pct = (x) => `${(x * 100).toFixed(2)}%`;

/** Per-class and macro precision/recall/F1. */
function score(yTrue, yPred, classes) {
  const perClass = [];
  let correct = 0;
  for (let i = 0; i < yTrue.length; i += 1) if (yTrue[i] === yPred[i]) correct += 1;

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
    perClass.push({ cls, precision, recall, f1, support: tp + fn });
  }

  const n = classes.length;
  return {
    accuracy: correct / yTrue.length,
    macroPrecision: perClass.reduce((a, c) => a + c.precision, 0) / n,
    macroRecall: perClass.reduce((a, c) => a + c.recall, 0) / n,
    macroF1: perClass.reduce((a, c) => a + c.f1, 0) / n,
    perClass,
  };
}

function confusionPairs(yTrue, yPred, limit = 12) {
  const pairs = new Map();
  for (let i = 0; i < yTrue.length; i += 1) {
    if (yTrue[i] === yPred[i]) continue;
    const key = `${yTrue[i]} -> ${yPred[i]}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  return [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function printClassTable(perClass) {
  console.log(
    `\n  ${pad('intent', 32)}${padStart('support', 9)}${padStart('precision', 11)}` +
    `${padStart('recall', 9)}${padStart('f1', 9)}`,
  );
  console.log('  ' + '-'.repeat(70));
  const sorted = [...perClass].sort((a, b) => a.f1 - b.f1);
  for (const c of sorted) {
    const flag = c.f1 < 0.7 ? '  <-- weak' : '';
    console.log(
      `  ${pad(c.cls, 32)}${padStart(c.support, 9)}${padStart(pct(c.precision), 11)}` +
      `${padStart(pct(c.recall), 9)}${padStart(pct(c.f1), 9)}${flag}`,
    );
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      dataset: { type: 'string', default: path.join(PROJECT_ROOT, 'datasets', 'training_dataset.csv') },
      split: { type: 'string', default: 'validation' },
      sweep: { type: 'boolean', default: false },
      examples: { type: 'boolean', default: false },
    },
  });

  const rows = parse(fs.readFileSync(values.dataset, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }).filter((r) => r.split === values.split);

  if (rows.length === 0) throw new Error(`No rows with split="${values.split}"`);

  const engine = new IntentEngine();
  const classes = engine.classifier.classes;

  const yTrue = [];
  const fullPred = [];
  const mlPred = [];
  const records = [];

  for (const row of rows) {
    const cleaned = clean(row.text);
    if (!cleaned) continue;

    const full = engine.predict(row.text);
    const ml = engine.classifier.predict(engine.vectorizer.transform(cleaned));

    yTrue.push(row.intent);
    fullPred.push(full.intent);
    mlPred.push(ml.confidence >= IntentEngine.CONFIDENCE_THRESHOLD ? ml.intent : 'fallback_unclear');
    records.push({ text: row.text, truth: row.intent, full, mlIntent: ml.intent, mlConf: ml.confidence });
  }

  console.log('='.repeat(78));
  console.log(`QSAFE Offline NLU - Evaluation  (${values.split} split, ${yTrue.length} rows)`);
  console.log('='.repeat(78));

  // --- full engine ---------------------------------------------------------
  const fullScores = score(yTrue, fullPred, classes);
  console.log('\nFULL ENGINE (production path: keyword -> phrase -> fuzzy -> ML -> guard)');
  console.log(`  accuracy   ${pct(fullScores.accuracy)}`);
  console.log(`  macro P/R/F1  ${pct(fullScores.macroPrecision)} / ${pct(fullScores.macroRecall)} / ${pct(fullScores.macroF1)}`);

  const tierTotals = {};
  const tierCorrect = {};
  records.forEach((r, i) => {
    const t = r.full.source;
    tierTotals[t] = (tierTotals[t] ?? 0) + 1;
    if (fullPred[i] === yTrue[i]) tierCorrect[t] = (tierCorrect[t] ?? 0) + 1;
  });
  console.log('\n  by tier:');
  for (const tier of Object.keys(tierTotals).sort()) {
    const total = tierTotals[tier];
    const ok = tierCorrect[tier] ?? 0;
    console.log(
      `    ${pad(tier, 16)}${padStart(total, 6)} rows ` +
      `${padStart(pct(total / yTrue.length), 9)} of traffic   accuracy ${pct(ok / total)}`,
    );
  }

  // --- ML tier only --------------------------------------------------------
  const mlScores = score(yTrue, mlPred, classes);
  console.log('\nML TIER ONLY (keyword tiers bypassed - true generalisation)');
  console.log(`  accuracy   ${pct(mlScores.accuracy)}`);
  console.log(`  macro P/R/F1  ${pct(mlScores.macroPrecision)} / ${pct(mlScores.macroRecall)} / ${pct(mlScores.macroF1)}`);

  printClassTable(mlScores.perClass);

  console.log('\n  top confusions (ML tier):');
  for (const [pair, count] of confusionPairs(yTrue, mlPred)) {
    console.log(`    ${padStart(count, 5)}  ${pair}`);
  }

  // --- calibration ---------------------------------------------------------
  if (values.sweep) {
    console.log('\nTHRESHOLD SWEEP (rows reaching the ML tier)');
    console.log('  Coverage = share answered instead of deferred to fallback_unclear.');
    console.log('  Precision-on-covered = accuracy among those answered.\n');
    console.log(`  ${pad('tau', 8)}${padStart('coverage', 11)}${padStart('acc-on-covered', 17)}${padStart('overall acc', 14)}`);
    console.log('  ' + '-'.repeat(50));

    const mlRows = records.filter((r) => r.full.source === 'ml' || r.full.source === 'fallback');
    for (const tau of [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6]) {
      let covered = 0;
      let coveredCorrect = 0;
      let overallCorrect = 0;
      for (const r of mlRows) {
        const answered = r.mlConf >= tau;
        const predicted = answered ? r.mlIntent : 'fallback_unclear';
        if (answered) {
          covered += 1;
          if (predicted === r.truth) coveredCorrect += 1;
        }
        if (predicted === r.truth) overallCorrect += 1;
      }
      const marker = Math.abs(tau - IntentEngine.CONFIDENCE_THRESHOLD) < 1e-9 ? '  <-- current' : '';
      console.log(
        `  ${pad(tau.toFixed(2), 8)}${padStart(pct(covered / mlRows.length), 11)}` +
        `${padStart(covered ? pct(coveredCorrect / covered) : 'n/a', 17)}` +
        `${padStart(pct(overallCorrect / mlRows.length), 14)}${marker}`,
      );
    }
  }

  if (values.examples) {
    console.log('\nMISCLASSIFIED EXAMPLES (full engine, first 25)');
    let shown = 0;
    for (let i = 0; i < records.length && shown < 25; i += 1) {
      if (fullPred[i] === yTrue[i]) continue;
      const r = records[i];
      console.log(`\n  "${r.text.slice(0, 68)}"`);
      console.log(`    expected ${r.truth}`);
      console.log(`    got      ${r.full.intent}  (${r.full.source}, ${r.full.confidence})`);
      shown += 1;
    }
  }

  console.log('\n' + '='.repeat(78));
  return 0;
}

process.exitCode = await main();

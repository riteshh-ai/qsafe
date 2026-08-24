/**
 * Cross-runtime parity: the Node engine must reproduce the Python/scikit-learn
 * reference implementation exactly.
 *
 * `tests/fixtures/python-golden.json` was produced by the Python engine over every row of
 * the training dataset plus adversarial edge cases, covering all four tiers. It is the
 * contract this migration is held to — the Python tree is archived, so this fixture is now
 * the only surviving record of the reference behaviour.
 *
 * A failure here means the port has drifted. Do not "fix" it by regenerating the fixture.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { IntentEngine } from '../src/services/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'python-golden.json');

/** Rounded to 4dp on both sides, so any genuine divergence is >= 1e-4. */
const CONFIDENCE_TOLERANCE = 1e-9;

let golden;
let engine;

before(() => {
  golden = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  engine = new IntentEngine();
});

describe('parity with the Python reference engine', () => {
  test('fixture is the expected shape', () => {
    assert.ok(golden.records.length > 6000, 'fixture should cover the full dataset');
    assert.equal(golden.records.length, golden.count);
    assert.equal(engine.constructor.CONFIDENCE_THRESHOLD, golden.confidenceThreshold);
  });

  test('every record matches on intent, confidence, source, urgency, entities and action', () => {
    const mismatches = [];

    for (const expected of golden.records) {
      const actual = engine.predict(expected.input);

      const diffs = [];
      if (actual.intent !== expected.intent) {
        diffs.push(`intent ${JSON.stringify(actual.intent)} != ${JSON.stringify(expected.intent)}`);
      }
      if (Math.abs(actual.confidence - expected.confidence) > CONFIDENCE_TOLERANCE) {
        diffs.push(`confidence ${actual.confidence} != ${expected.confidence}`);
      }
      if (actual.source !== expected.source) {
        diffs.push(`source ${actual.source} != ${expected.source}`);
      }
      if (actual.urgency !== expected.urgency) {
        diffs.push(`urgency ${actual.urgency} != ${expected.urgency}`);
      }
      if (actual.recommended_action !== expected.recommended_action) {
        diffs.push(
          `action ${JSON.stringify(actual.recommended_action)} != ${JSON.stringify(expected.recommended_action)}`,
        );
      }
      const actualEntities = JSON.stringify(actual.entities);
      const expectedEntities = JSON.stringify(expected.entities);
      if (actualEntities !== expectedEntities) {
        diffs.push(`entities ${actualEntities} != ${expectedEntities}`);
      }

      if (diffs.length) {
        mismatches.push({ input: expected.input.slice(0, 70), diffs });
      }
    }

    assert.deepEqual(
      mismatches.slice(0, 10),
      [],
      `${mismatches.length}/${golden.records.length} records diverged from Python`,
    );
    assert.equal(mismatches.length, 0);
  });

  test('the tier distribution is unchanged', () => {
    const count = (records, key) =>
      records.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] ?? 0) + 1), acc), {});

    const expected = count(golden.records, 'source');
    const actual = count(
      golden.records.map((r) => engine.predict(r.input)),
      'source',
    );

    assert.deepEqual(actual, expected);
  });
});

describe('performance', () => {
  test('median latency stays under the 5ms budget', () => {
    // nlpClient.js aborts at 500ms, and the Python service documented <5ms/query.
    const samples = golden.records.slice(0, 1000).map((r) => r.input);

    for (const text of samples.slice(0, 50)) engine.predict(text); // warm up

    const timings = samples.map((text) => {
      const start = process.hrtime.bigint();
      engine.predict(text);
      return Number(process.hrtime.bigint() - start) / 1e6;
    });

    timings.sort((a, b) => a - b);
    const median = timings[Math.floor(timings.length / 2)];
    const p99 = timings[Math.floor(timings.length * 0.99)];

    assert.ok(median < 5, `median ${median.toFixed(3)}ms exceeds the 5ms budget`);
    assert.ok(p99 < 50, `p99 ${p99.toFixed(3)}ms is unreasonably slow`);
  });
});

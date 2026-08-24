/** Port of `offline-nlp/tests/test_robustness.py`. */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { getEngine, resetEngine } from '../src/services/engine.js';

let engine;
before(() => {
  resetEngine();
  engine = getEngine();
});

describe('typo resilience', () => {
  test('misspelled earthquake', () => {
    const res = engine.predict('earthquke help');
    assert.ok(['earthquake_occurring_report', 'sos_help_request'].includes(res.intent));
  });

  test('misspelled romanized nepali', () => {
    const res = engine.predict('bhukomp');
    assert.ok(['earthquake_occurring_report', 'fallback_unclear'].includes(res.intent));
  });

  test('misspelled ambulance', () => {
    const res = engine.predict('amblance');
    assert.ok(
      ['medical_emergency_request', 'sos_help_request', 'fallback_unclear'].includes(res.intent),
    );
  });

  test('misspelled emergency', () => {
    const res = engine.predict('emrgency');
    assert.ok(
      ['sos_help_request', 'medical_emergency_request', 'fallback_unclear'].includes(res.intent),
    );
  });
});

describe('mixed scripts and colloquialisms', () => {
  test('code-switched message', () => {
    const res = engine.predict('please help mero ghar भत्कियो');
    assert.ok(['ml', 'keyword', 'keyword_fuzzy'].includes(res.source));
    assert.ok(
      [
        'earthquake_occurring_report', 'sos_help_request',
        'building_collapse_report', 'trapped_debris_report',
      ].includes(res.intent),
    );
  });

  test('romanized nepali urgency', () => {
    assert.equal(engine.predict('mero ghar bhatkiyo bachau').urgency, 'HIGH');
  });
});

describe('elongated / panic typing', () => {
  test('elongated words', () => {
    const res = engine.predict('heeeeelp meeeeee');
    assert.ok(['sos_help_request', 'fallback_unclear'].includes(res.intent));
  });

  test('all-caps panic', () => {
    assert.equal(engine.predict('HELP ME EARTHQUAKE BUILDING FALLING').urgency, 'HIGH');
  });
});

describe('out-of-domain queries fall back', () => {
  const queries = [
    'what time is the match tomorrow?',
    'how do i bake a chocolate cake?',
    'what is the meaning of life?',
    'Can you play some music?',
    'tell me a joke',
    'who won the world cup',
  ];

  test('never classified as a disaster intent, never flagged urgent', () => {
    for (const q of queries) {
      const res = engine.predict(q);
      assert.equal(res.intent, 'fallback_unclear', `OOD query "${q}" -> "${res.intent}"`);
      assert.equal(res.urgency, 'LOW', `OOD query "${q}" flagged HIGH urgency`);
    }
  });
});

describe('emoji-based emergency queries', () => {
  test('fire', () => {
    const res = engine.predict('🔥 my house is on fire');
    assert.equal(res.intent, 'fire_incident_report');
    assert.equal(res.urgency, 'HIGH');
  });

  test('medical', () => {
    const res = engine.predict('🚑 someone is unconscious');
    assert.ok(['medical_emergency_request', 'sos_help_request'].includes(res.intent));
  });

  test('emoji only', () => {
    const res = engine.predict('🆘🚨');
    assert.equal(res.intent, 'sos_help_request');
    assert.equal(res.urgency, 'HIGH');
  });
});

describe('context preservation under stress', () => {
  test('entities survive punctuation noise', () => {
    const res = engine.predict('!!!! 10 people stuck kathmandu help!!!!');
    assert.equal(res.entities.headcount, '10');
    assert.equal(res.entities.location, 'kathmandu');
    assert.equal(res.urgency, 'HIGH');
  });

  test('entities survive typos', () => {
    const res = engine.predict('5 people injurd in pokhara earthquke');
    assert.equal(res.entities.location, 'pokhara');
  });
});

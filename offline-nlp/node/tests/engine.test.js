/** Port of `offline-nlp/tests/test_engine.py`. */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { IntentEngine, getEngine, resetEngine } from '../src/services/engine.js';

let engine;
before(() => {
  resetEngine();
  engine = getEngine();
});

describe('tier 1 - keyword matching', () => {
  test('exact keyword', () => {
    const res = engine.predict('hello');
    assert.equal(res.intent, 'greeting');
    assert.equal(res.confidence, 1.0);
    assert.equal(res.source, 'keyword');
    assert.ok(res.latency_ms < 50.0);
  });

  test('devanagari keyword', () => {
    const res = engine.predict('नमस्ते');
    assert.equal(res.intent, 'greeting');
    assert.equal(res.confidence, 1.0);
    assert.equal(res.source, 'keyword');
  });

  test('fuzzy keyword', () => {
    const res = engine.predict('earthquke');
    assert.equal(res.intent, 'earthquake_occurring_report');
    assert.equal(res.confidence, 0.95);
    assert.equal(res.source, 'keyword_fuzzy');
  });

  test('phrase rules', () => {
    assert.equal(engine.predict("what's happening in my area").intent, 'status_check_general');
    assert.equal(
      engine.predict('need structural integrity check before going inside').intent,
      'building_damage_check',
    );
    assert.equal(engine.predict('please show cpr instructions').intent, 'first_aid_query');
    assert.equal(engine.predict('blackout in our neighborhood').intent, 'power_outage_report');
    assert.equal(
      engine.predict("can't find family after the earthquake").intent,
      'family_member_missing',
    );
    for (const q of [
      "what's happening in my area",
      'need structural integrity check before going inside',
      'please show cpr instructions',
    ]) {
      assert.equal(engine.predict(q).source, 'keyword');
    }
  });

  test('contact phrase takes priority', () => {
    const res = engine.predict('what is the ambulance number');
    assert.equal(res.intent, 'emergency_contact_request');
    assert.equal(res.recommended_action, 'show_emergency_contacts');
  });
});

describe('tier 2 - ML classification', () => {
  test('romanized nepali reaches the classifier', () => {
    const res = engine.predict('ghar vatyoo help garnus');
    assert.equal(res.source, 'ml');
    assert.ok(
      ['sos_help_request', 'trapped_debris_report', 'building_collapse_report'].includes(res.intent),
    );
    assert.ok(res.confidence > IntentEngine.CONFIDENCE_THRESHOLD);
  });

  test('long-form fire report', () => {
    const res = engine.predict(
      'the building next to us is burning badly please send fire brigade',
    );
    assert.ok(['fire_incident_report', 'fallback_unclear'].includes(res.intent));
    assert.equal(res.urgency, 'HIGH');
  });
});

describe('tier 3 - fallback', () => {
  test('off-topic query is not answered as a disaster intent', () => {
    const res = engine.predict('what is the weather like in kathmandu tomorrow');
    assert.equal(res.intent, 'fallback_unclear');
    if (res.source === 'fallback') {
      assert.ok(res.confidence < IntentEngine.CONFIDENCE_THRESHOLD);
    }
  });

  test('empty, null and non-string input never crash', () => {
    for (const bad of ['', null, undefined, 12345, {}, []]) {
      const res = engine.predict(bad);
      assert.equal(res.source, 'fallback', `input ${JSON.stringify(bad)}`);
      assert.equal(res.intent, 'fallback_unclear');
    }
  });
});

describe('urgency detection', () => {
  test('high urgency signals', () => {
    assert.equal(engine.predict('help!').urgency, 'HIGH');
    assert.equal(engine.predict('EARTHQUAKE HAPPENING NOW').urgency, 'HIGH');
    assert.equal(engine.predict('someone is trapped please send rescue').urgency, 'HIGH');
    assert.equal(engine.predict('मद्दत चाहियो').urgency, 'HIGH');
  });

  test('low urgency', () => {
    assert.equal(engine.predict('hello').urgency, 'LOW');
  });

  test('caseless script is not mistaken for shouting', () => {
    // Python's str.isupper() is false with no cased characters; a naive
    // text === text.toUpperCase() check would flag all Devanagari as HIGH.
    assert.equal(engine.predict('नमस्ते').urgency, 'LOW');
  });
});

describe('entity extraction', () => {
  test('headcount', () => {
    assert.equal(engine.predict('5 people injured in building collapse').entities.headcount, '5');
  });

  test('location', () => {
    assert.equal(engine.predict('earthquake hit kathmandu').entities.location, 'kathmandu');
    assert.ok('location' in engine.predict('काठमाडौंमा भूकम्प').entities);
  });

  test('combined', () => {
    const res = engine.predict('3 people trapped in patan after earthquake');
    assert.equal(res.entities.headcount, '3');
    assert.equal(res.entities.location, 'patan');
  });

  test('none', () => {
    assert.deepEqual(engine.predict('hello').entities, {});
  });

  test('devanagari digits are recognised by the numeric part of the pattern', () => {
    // Python's \d is Unicode-aware; JS's is ASCII-only, so this guards the \p{Nd} port.
    assert.equal(engine.predict('५ people trapped').entities.headcount, '५');
  });

  test('a Devanagari unit word yields no headcount, matching the reference engine', () => {
    // Documents a real limitation carried over deliberately: the unit words in the
    // headcount pattern (people|injured|...|jana) are Latin-only, so "५ जना घाइते"
    // extracts the location but not the count. Changing this would diverge from the
    // Python engine, so it is pinned rather than fixed.
    const res = engine.predict('५ जना घाइते छन् पोखरामा');
    assert.equal(res.entities.headcount, undefined);
    assert.equal(res.entities.location, 'पोखरा');
  });
});

describe('quick actions', () => {
  test('mapped intents', () => {
    assert.equal(engine.predict('ambulance').recommended_action, 'show_ambulance_button');
    assert.equal(engine.predict('fire').recommended_action, 'show_fire_button');
    assert.equal(engine.predict('earthquake').recommended_action, 'show_earthquake_guidance');
    const shelter = engine.predict('shelter');
    assert.equal(shelter.intent, 'shelter_request');
    assert.equal(shelter.recommended_action, 'show_shelter_map');
  });

  test('fallback carries no action', () => {
    assert.equal(engine.predict('random gibberish xyz abc 123').recommended_action, null);
  });
});

describe('emoji intelligence', () => {
  test('emoji map into intents', () => {
    assert.equal(engine.predict('🔥🔥🔥').intent, 'fire_incident_report');
    assert.equal(engine.predict('🆘').intent, 'sos_help_request');
    assert.equal(engine.predict('🚑').intent, 'medical_emergency_request');
  });
});

describe('batch predict', () => {
  test('returns one result per input', () => {
    const results = engine.batchPredict(['hello', 'ghar vatyoo help garnus', '']);
    assert.equal(results.length, 3);
    assert.equal(results[0].source, 'keyword');
    assert.ok(['ml', 'fallback'].includes(results[1].source));
    assert.equal(results[2].source, 'fallback');
  });
});

describe('output schema', () => {
  test('every prediction carries all fields regardless of tier', () => {
    const required = [
      'intent', 'confidence', 'source', 'urgency',
      'entities', 'recommended_action', 'latency_ms',
    ];
    for (const q of ['hello', 'earthquake help 5 people kathmandu', '', 'xyz random']) {
      const res = engine.predict(q);
      for (const key of required) {
        assert.ok(key in res, `missing "${key}" for input "${q}"`);
      }
      assert.equal(typeof res.intent, 'string');
      assert.equal(typeof res.confidence, 'number');
      assert.ok(res.recommended_action === null || typeof res.recommended_action === 'string');
    }
  });
});

// Response-routing regression suite.
//
// Guards the layer that produced the "emergency kit" -> EARTHQUAKE bug: the
// offline NLP classifier was correct (preparedness_tips_query @ 1.00, exact
// keyword hit) and the intent-to-card table sent it to the wrong protocol.
// These are pure unit tests over the routing table and the frontend's offline
// matcher — no servers, no model, no network.
//
// Run: node --test backend/tests/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INTENT_RESPONSE_MAP, UNMAPPED_BY_DESIGN } from '../src/services/ragService.js';
import { EMERGENCY_SAFETY_RESPONSES } from '../src/prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// The trained taxonomy. offline-nlp/tests/test_response_routing.py asserts this
// same list against datasets/training_dataset.csv, so the two ends cannot drift
// apart silently.
const TAXONOMY = [
  'aftershock_information_query', 'building_collapse_report', 'building_damage_check',
  'earthquake_occurring_report', 'emergency_contact_request', 'evacuation_guidance_query',
  'fallback_unclear', 'family_member_missing', 'family_reunification_status',
  'fire_incident_report', 'first_aid_query', 'food_water_request', 'gas_leak_report',
  'goodbye_thanks', 'greeting', 'injury_report', 'medical_emergency_request',
  'power_outage_report', 'preparedness_tips_query', 'road_blockage_report',
  'safe_location_query', 'shelter_request', 'sos_help_request', 'status_check_general',
  'trapped_debris_report',
];

// Cards that assert a specific disaster is happening. Routing an ambiguous or
// general intent to one of these is the false-certainty failure mode.
const SPECIFIC_DISASTER_CARDS = new Set([
  'earthquake', 'flood', 'landslide', 'fire', 'building_collapse', 'trapped_sos',
]);

describe('intent -> response card table', () => {
  test('every taxonomy intent is either mapped or explicitly unmapped', () => {
    for (const intent of TAXONOMY) {
      const accounted =
        Object.hasOwn(INTENT_RESPONSE_MAP, intent) || UNMAPPED_BY_DESIGN.has(intent);
      assert.ok(accounted, `intent "${intent}" is neither mapped nor declared unmapped-by-design`);
    }
  });

  test('the table contains no intents outside the taxonomy', () => {
    // Dead keys (landslide_hazard_query, flood_occurring_report, ...) can never
    // fire and quietly rot into misleading documentation of the routing.
    const known = new Set(TAXONOMY);
    for (const intent of Object.keys(INTENT_RESPONSE_MAP)) {
      assert.ok(known.has(intent), `"${intent}" is routed but is not a trained intent`);
    }
  });

  test('every routed card exists in EMERGENCY_SAFETY_RESPONSES with all three languages', () => {
    for (const [intent, card] of Object.entries(INTENT_RESPONSE_MAP)) {
      const responses = EMERGENCY_SAFETY_RESPONSES[card];
      assert.ok(responses, `intent "${intent}" routes to missing card "${card}"`);
      for (const lang of ['en', 'ne_dev', 'ne_rom']) {
        assert.ok(responses[lang]?.trim(), `card "${card}" has no ${lang} text`);
      }
    }
  });

  test('an intent is never mapped to a card that contradicts it', () => {
    assert.notEqual(
      INTENT_RESPONSE_MAP.preparedness_tips_query, 'earthquake',
      'REGRESSION: "emergency kit" -> EARTHQUAKE SAFETY PROTOCOL',
    );
    assert.equal(INTENT_RESPONSE_MAP.preparedness_tips_query, 'emergency_kit');

    assert.notEqual(
      INTENT_RESPONSE_MAP.food_water_request, 'emergency_kit',
      'an active relief request must not be answered with a pre-disaster packing list',
    );
  });
});

describe('ambiguity must not become false certainty', () => {
  test('a bare distress signal does not select a specific disaster protocol', () => {
    // "help" / "emergency" classify as sos_help_request at confidence 1.00, but
    // the user has named no disaster. Answering with the trapped-under-debris
    // card invents a buried-alive scenario and its advice ("tap on pipes",
    // "conserve oxygen", "do not yell") is wrong for a caller who is not buried.
    const card = INTENT_RESPONSE_MAP.sos_help_request;
    assert.ok(
      !SPECIFIC_DISASTER_CARDS.has(card),
      `sos_help_request routes to specific disaster card "${card}"`,
    );
    assert.equal(card, 'contacts');
  });

  test('a contentless status question is not forced into a disaster card', () => {
    assert.ok(
      UNMAPPED_BY_DESIGN.has('status_check_general'),
      'status_check_general must fall through to clarification, not a protocol card',
    );
    assert.ok(!Object.hasOwn(INTENT_RESPONSE_MAP, 'status_check_general'));
  });

  test('the unknown intent is never routed to a card', () => {
    assert.ok(!Object.hasOwn(INTENT_RESPONSE_MAP, 'fallback_unclear'));
  });
});

// ---------------------------------------------------------------------------
// Frontend offline matcher (frontend/app.js LAYER 4), loaded from source so the
// browser path and the server path are checked against one corpus.
// ---------------------------------------------------------------------------
function loadFrontendMatcher() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'frontend', 'app.js'), 'utf8');
  const rules = src.match(/const INTENT_RULES = \[([\s\S]*?)\n\];/);
  const helpers = src.match(/const LATIN_KEYWORD = [\s\S]*?\nfunction matchLocalIntent\(query\) \{[\s\S]*?\n\}/);
  assert.ok(rules && helpers, 'could not extract INTENT_RULES / matchLocalIntent from frontend/app.js');
  return new Function(`
    const INTENT_RULES = [${rules[1]}];
    ${helpers[0]}
    return matchLocalIntent;
  `)();
}

describe('frontend offline matcher', () => {
  const matchLocalIntent = loadFrontendMatcher();

  test('every rule intent belongs to the taxonomy', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'frontend', 'app.js'), 'utf8');
    const known = new Set(TAXONOMY);
    for (const [, intent] of src.matchAll(/\{ intent: '([a-z_]+)', keywords:/g)) {
      assert.ok(known.has(intent), `frontend rule "${intent}" is not a trained intent`);
    }
  });

  test('short Latin keywords do not match inside longer words', () => {
    // REGRESSION: unanchored includes() let the 2-char 'hi' in the greeting rule
    // (which is first in INTENT_RULES) swallow real distress reports.
    for (const q of ['my child is trapped', 'this building is shaking', 'which way to evacuate']) {
      assert.notEqual(matchLocalIntent(q), 'greeting', `"${q}" matched greeting via a substring`);
    }
    assert.equal(matchLocalIntent('my child is trapped'), 'trapped_debris_report');
  });

  test('exact greetings still match', () => {
    for (const q of ['hi', 'hello', 'namaste', 'hey there']) {
      assert.equal(matchLocalIntent(q), 'greeting', `"${q}" should match greeting`);
    }
  });

  test('core queries resolve offline the same way they do online', () => {
    const expected = {
      'earthquake': 'earthquake_occurring_report',
      'bhuikampa': 'earthquake_occurring_report',
      'भूकम्प': 'earthquake_occurring_report',
      'emergency kit': 'preparedness_tips_query',
      'आपतकालीन किट': 'preparedness_tips_query',
      'first aid': 'first_aid_query',
      'no electricity since morning': 'power_outage_report',
      'we need tents and shelter': 'shelter_request',
      'will there be aftershocks': 'aftershock_information_query',
    };
    for (const [query, intent] of Object.entries(expected)) {
      assert.equal(matchLocalIntent(query), intent, `offline "${query}"`);
    }
  });

  test('preparedness beats the generic earthquake rule for go-bag questions', () => {
    // keywords.csv maps "earthquake go bag" -> preparedness_tips_query; the
    // offline rule order must agree or the two paths disagree on the same input.
    assert.equal(matchLocalIntent('how to prepare an earthquake go bag'), 'preparedness_tips_query');
  });

  test('out-of-domain queries match nothing', () => {
    for (const q of ['python programming', 'tell me a joke', 'what is the weather']) {
      assert.equal(matchLocalIntent(q), null, `"${q}" should not match any intent`);
    }
  });
});

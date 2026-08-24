/** Port of `offline-nlp/tests/test_preprocessor.py`. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { clean } from '../src/utils/preprocessor.js';

describe('preprocessor.clean', () => {
  test('basic latin', () => {
    assert.equal(clean('Hello World'), 'hello world');
    assert.equal(clean('  emergency   Help!  '), 'emergency help');
  });

  test('devanagari', () => {
    assert.equal(clean('नमस्ते'), 'नमस्ते');
    assert.equal(clean('मलाई सहयोग चाहियो !!'), 'मलाई सहयोग चाहियो');
  });

  test('mixed script', () => {
    assert.equal(clean('help me भूकम्प गयो'), 'help me भूकम्प गयो');
  });

  test('numbers survive', () => {
    assert.equal(clean('Call 911 please'), 'call 911 please');
  });

  test('noise and punctuation are stripped', () => {
    assert.equal(clean('!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./'), '');
    assert.equal(clean('help!!!'), 'help');
  });

  test('empty, null and non-string input', () => {
    assert.equal(clean(null), '');
    assert.equal(clean(undefined), '');
    assert.equal(clean(12345), '');
    assert.equal(clean(''), '');
    assert.equal(clean('    '), '');
  });

  test('emojis become semantic text', () => {
    assert.equal(clean('help 🚨'), 'help emergency');
    assert.equal(clean('🚨🚨🚨'), 'emergency emergency emergency');
    assert.equal(clean('🔥'), 'fire');
  });

  test('a BOM is deleted rather than treated as whitespace', () => {
    // Python's \s excludes U+FEFF while JavaScript's includes it; treating it as
    // whitespace here would leave a stray space the Python engine never produced.
    assert.equal(clean('﻿help'), 'help');
    assert.equal(clean('a﻿b'), 'ab');
  });

  test('NFC normalisation is applied', () => {
    // Devanagari KA + nukta, decomposed vs precomposed, must collapse to one form.
    assert.equal(clean('क़'), clean('क़'));
  });
});

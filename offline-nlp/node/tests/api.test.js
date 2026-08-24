/**
 * HTTP contract tests.
 *
 * `backend/src/services/nlpClient.js` is unchanged by this migration, so the Express
 * service must answer exactly as the FastAPI one did — same paths, same status codes,
 * same body shapes, same snake_case field names.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/app.js';
import { initEngine, resetRegistry } from '../src/services/engineRegistry.js';

let server;
let baseUrl;

before(async () => {
  process.env.NLP_LOG_REQUESTS = 'false';
  resetRegistry();
  const { ok, error } = initEngine();
  assert.ok(ok, `engine failed to load: ${error?.message}`);

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

const post = (path, body, init = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });

describe('GET /health', () => {
  test('reports the engine as loaded', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      status: 'ok',
      message: 'QSafe Offline NLP Microservice Active',
    });
  });
});

describe('POST /predict', () => {
  test('returns the full QueryResponse contract', async () => {
    const res = await post('/predict', { text: 'I am trapped under debris' });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(
      Object.keys(body).sort(),
      ['confidence', 'entities', 'intent', 'latency_ms', 'recommended_action', 'source', 'urgency'],
    );
    assert.equal(body.intent, 'trapped_debris_report');
    assert.equal(body.source, 'keyword');
    assert.equal(body.urgency, 'HIGH');
    assert.equal(body.recommended_action, 'show_ambulance_button');
    assert.equal(typeof body.confidence, 'number');
    assert.equal(typeof body.latency_ms, 'number');
  });

  test('field names stay snake_case - the wire contract, not JS style', async () => {
    const body = await (await post('/predict', { text: 'emergency kit' })).json();
    assert.ok('recommended_action' in body);
    assert.ok('latency_ms' in body);
    assert.ok(!('recommendedAction' in body));
    assert.ok(!('latencyMs' in body));
  });

  test('the routing fix holds end to end', async () => {
    const body = await (await post('/predict', { text: 'emergency kit' })).json();
    assert.equal(body.intent, 'preparedness_tips_query');
    assert.equal(body.confidence, 1.0);
  });

  test('multilingual input', async () => {
    for (const [text, intent] of [
      ['भूकम्प', 'earthquake_occurring_report'],
      ['आपतकालीन किट', 'preparedness_tips_query'],
      ['bhuikampa', 'earthquake_occurring_report'],
    ]) {
      const body = await (await post('/predict', { text })).json();
      assert.equal(body.intent, intent, `"${text}"`);
    }
  });

  test('null text is rejected with 422, matching FastAPI', async () => {
    const res = await post('/predict', { text: null });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.ok(Array.isArray(body.detail));
    assert.deepEqual(body.detail[0].loc, ['body', 'text']);
  });

  test('missing text is rejected with 422', async () => {
    const res = await post('/predict', {});
    assert.equal(res.status, 422);
    assert.ok(Array.isArray((await res.json()).detail));
  });

  test('malformed JSON is a 422, not a 500', async () => {
    const res = await post('/predict', '{"text": ');
    assert.equal(res.status, 422);
    assert.ok(Array.isArray((await res.json()).detail));
  });

  test('empty string is valid input and reaches the fallback tier', async () => {
    const res = await post('/predict', { text: '' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.intent, 'fallback_unclear');
    assert.equal(body.source, 'fallback');
  });

  test('oversized bodies are rejected, not buffered', async () => {
    const res = await post('/predict', { text: 'x'.repeat(200_000) });
    assert.equal(res.status, 413);
  });
});

describe('routing', () => {
  test('unknown paths 404 as JSON', async () => {
    const res = await fetch(`${baseUrl}/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { detail: 'Not Found' });
  });

  test('service info is available at the root', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.engineLoaded, true);
    assert.ok(body.runtime.startsWith('node '));
  });

  test('no x-powered-by header is leaked', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('degraded mode', () => {
  test('503 on both endpoints when the engine failed to load', async () => {
    // Mirrors the FastAPI lifespan: a load failure keeps the service up so the
    // failure is legible to nlpClient.js rather than manifesting as a dead socket.
    resetRegistry();
    const app = createApp();
    const downServer = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = `http://127.0.0.1:${downServer.address().port}`;

    try {
      const health = await fetch(`${url}/health`);
      assert.equal(health.status, 503);
      assert.equal((await health.json()).detail, 'Intent classification engine not loaded.');

      const predict = await fetch(`${url}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'earthquake' }),
      });
      assert.equal(predict.status, 503);
      assert.equal((await predict.json()).detail, 'Engine not initialized.');
    } finally {
      await new Promise((resolve) => downServer.close(resolve));
      initEngine(); // restore for any later suites in this process
    }
  });
});

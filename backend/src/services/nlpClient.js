// src/services/nlpClient.js
/**
 * Internal Client to communicate with the local Python offline-nlp FastAPI microservice.
 * Exposes getOfflineIntent(text) with strict timeout and fallback mechanism.
 */

const LOCAL_NLP_SERVICE_URL = 'http://127.0.0.1:8000/predict';
const REQUEST_TIMEOUT_MS = 500;

export async function getOfflineIntent(text) {
  const defaultFallback = {
    intent: 'fallback_unclear',
    confidence: 0.0,
    source: 'offline_fallback',
    urgency: 'LOW',
    entities: {},
    recommended_action: null,
    latency_ms: 0.0
  };

  if (!text || typeof text !== 'string') {
    return defaultFallback;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(LOCAL_NLP_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ Offline NLP microservice returned status ${response.status}. Falling back to default.`);
      return defaultFallback;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`⚠️ Offline NLP microservice request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    } else {
      console.warn(`⚠️ Offline NLP microservice connection failed: ${error.message}`);
    }
    return defaultFallback;
  }
}

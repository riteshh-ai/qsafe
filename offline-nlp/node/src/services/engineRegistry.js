/**
 * Engine lifecycle.
 *
 * Mirrors api.py's FastAPI `lifespan`: the engine is built once at startup, and a failure
 * there is captured rather than thrown, leaving the service up to answer 503. That keeps
 * the failure legible to `nlpClient.js`, which treats any non-200 as a fallback signal.
 */
import { IntentEngine } from './engine.js';

let engine = null;
let loadError = null;

/**
 * Build the engine. Safe to call once at boot.
 * @returns {{ok: boolean, error?: Error}}
 */
export function initEngine() {
  try {
    engine = new IntentEngine();
    loadError = null;
    return { ok: true };
  } catch (error) {
    engine = null;
    loadError = error;
    // Matches the Python service, which printed and continued so /health could report it.
    console.error(`Error initializing IntentEngine: ${error.message}`);
    return { ok: false, error };
  }
}

/** @returns {IntentEngine|null} */
export function getEngineOrNull() {
  return engine;
}

/** @returns {Error|null} */
export function getLoadError() {
  return loadError;
}

/** Test helper. */
export function resetRegistry() {
  engine = null;
  loadError = null;
}

export default { initEngine, getEngineOrNull, getLoadError, resetRegistry };

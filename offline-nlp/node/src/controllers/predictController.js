/**
 * Controllers for the intent-classification endpoints.
 *
 * Status codes and body shapes reproduce api.py exactly:
 *   503 {detail}  engine failed to load
 *   422 {detail}  request body failed validation (FastAPI's shape)
 *   500 {detail}  inference raised
 *   200            QueryResponse
 */
import { getEngineOrNull, getLoadError } from '../services/engineRegistry.js';
import { QueryRequestSchema, toValidationDetail } from '../schemas/predict.js';
import { config } from '../config/index.js';

/** GET /health — mirrors `health_check()`. */
export function healthCheck(req, res) {
  const engine = getEngineOrNull();
  if (engine === null) {
    return res
      .status(503)
      .json({ detail: 'Intent classification engine not loaded.' });
  }
  return res.status(200).json({
    status: 'ok',
    message: `${config.serviceName} Active`,
  });
}

/** POST /predict — mirrors `predict_intent()`. */
export function predictIntent(req, res) {
  const engine = getEngineOrNull();
  if (engine === null) {
    return res.status(503).json({ detail: 'Engine not initialized.' });
  }

  const parsed = QueryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ detail: toValidationDetail(parsed.error) });
  }

  try {
    const result = engine.predict(parsed.data.text);

    // The Python engine attaches `error` instead of raising when inference fails
    // internally; api.py turned that into a 500.
    if (result.error !== undefined) {
      return res.status(500).json({ detail: result.error });
    }

    // Shaped explicitly rather than returned wholesale, matching FastAPI's
    // `response_model=QueryResponse`, which drops any extra keys.
    return res.status(200).json({
      intent: result.intent,
      confidence: result.confidence,
      source: result.source,
      urgency: result.urgency,
      entities: result.entities,
      recommended_action: result.recommended_action,
      latency_ms: result.latency_ms,
    });
  } catch (error) {
    return res.status(500).json({ detail: error.message });
  }
}

/** GET / — service metadata. The Python service had no root route; this is additive. */
export function serviceInfo(req, res) {
  const engine = getEngineOrNull();
  const loadError = getLoadError();
  return res.status(200).json({
    service: config.serviceName,
    version: config.version,
    runtime: `node ${process.version}`,
    engineLoaded: engine !== null,
    ...(loadError ? { loadError: loadError.message } : {}),
    endpoints: { health: 'GET /health', predict: 'POST /predict' },
  });
}

export default { healthCheck, predictIntent, serviceInfo };

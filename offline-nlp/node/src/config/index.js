/**
 * Service configuration.
 *
 * Defaults reproduce the Python service's binding so
 * `backend/src/services/nlpClient.js` (hardcoded to 127.0.0.1:8000) keeps working with no
 * changes. Every value is overridable by environment variable for deployment.
 */
import dotenv from 'dotenv';

dotenv.config();

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative integer, got "${raw}"`);
  }
  return parsed;
}

export const config = Object.freeze({
  host: process.env.NLP_HOST || '127.0.0.1',
  port: intFromEnv('NLP_PORT', 8000),
  /**
   * Body size cap. Requests are single short queries; the Python service inherited
   * Starlette's default, but an explicit small limit is the safer production posture.
   */
  jsonBodyLimit: process.env.NLP_BODY_LIMIT || '64kb',
  logRequests: process.env.NLP_LOG_REQUESTS !== 'false',
  serviceName: 'QSafe Offline NLP Microservice',
  version: '1.0.0',
});

export default config;

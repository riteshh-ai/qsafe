/**
 * Request/response schemas — the Zod replacement for api.py's Pydantic models.
 *
 * The 422 error body deliberately mirrors FastAPI's validation-error shape
 * (`{detail: [{loc, msg, type}]}`) so any existing client error handling keeps working.
 */
import { z } from 'zod';

/** Pydantic: `class QueryRequest(BaseModel): text: str` */
export const QueryRequestSchema = z.object({
  text: z.string(),
});

/**
 * Pydantic `QueryResponse`. Field names stay snake_case: they are the wire contract that
 * `nlpClient.js` and `ragService.js` read, not internal JS identifiers.
 */
export const QueryResponseSchema = z.object({
  intent: z.string(),
  confidence: z.number(),
  source: z.string(),
  urgency: z.string(),
  entities: z.record(z.string(), z.unknown()),
  recommended_action: z.string().nullable(),
  latency_ms: z.number(),
});

/**
 * Translate a Zod error into FastAPI's 422 body shape.
 * @param {import('zod').ZodError} error
 */
export function toValidationDetail(error) {
  return error.issues.map((issue) => ({
    loc: ['body', ...issue.path],
    msg: issue.message,
    type: issue.code,
  }));
}

export default { QueryRequestSchema, QueryResponseSchema, toValidationDetail };

/**
 * Express application — the replacement for api.py's FastAPI app.
 *
 * Exported separately from `server.js` so tests can mount it without binding a port.
 */
import express from 'express';

import routes from './routes/index.js';
import { config } from './config/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(express.json({ limit: config.jsonBodyLimit }));

  // Malformed JSON must not surface as a 500. FastAPI answered these with 422, so the
  // body-parser's own SyntaxError is translated to match.
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(422).json({
        detail: [{ loc: ['body'], msg: 'Invalid JSON body', type: 'value_error.jsondecode' }],
      });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ detail: 'Request body too large.' });
    }
    return next(err);
  });

  if (config.logRequests) {
    app.use((req, res, next) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(2)}ms`);
      });
      next();
    });
  }

  app.use('/', routes);

  app.use((req, res) => {
    res.status(404).json({ detail: 'Not Found' });
  });

  // Terminal error handler: never leak a stack trace to the client.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('Unhandled error:', err);
    if (res.headersSent) return;
    res.status(500).json({ detail: 'Internal Server Error' });
  });

  return app;
}

export default createApp;

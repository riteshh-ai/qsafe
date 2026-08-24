#!/usr/bin/env node
/**
 * HTTP entry point — replaces `uvicorn src.api:app`.
 *
 * The engine is built before the listener opens, so the service never accepts traffic in a
 * half-initialised state. A load failure still starts the server (answering 503), matching
 * the Python lifespan's behaviour.
 */
import { createApp } from './app.js';
import { config } from './config/index.js';
import { initEngine } from './services/engineRegistry.js';

function start() {
  const started = process.hrtime.bigint();
  const { ok, error } = initEngine();
  const loadMs = Number(process.hrtime.bigint() - started) / 1e6;

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`${config.serviceName} v${config.version}`);
    console.log(`   runtime : node ${process.version}`);
    console.log(`   engine  : ${ok ? `loaded in ${loadMs.toFixed(0)}ms` : `FAILED - ${error.message}`}`);
    console.log(`   listening on http://${config.host}:${config.port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => process.exit(0));
    // Don't hang forever on lingering keep-alive sockets.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

start();

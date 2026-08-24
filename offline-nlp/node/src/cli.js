#!/usr/bin/env node
/**
 * CLI — replaces `python -m src.main`.
 *
 * Subcommands:
 *   test       classify a set of sample queries and print the tiers they hit
 *   benchmark  latency benchmark against the documented <5ms/query target
 *   serve      start the HTTP microservice
 *
 * Training lives in `scripts/train.js` (it reads the dataset and writes artifacts, so it
 * is a build step rather than a service concern).
 */
import { parseArgs } from 'node:util';
import { IntentEngine } from './services/engine.js';

const SAMPLES = [
  // Tier 1: keyword matches
  ['namaste', 'greeting'],
  ['hello', 'greeting'],
  ['नमस्ते', 'greeting'],
  // Tier 2: ML classification
  ['building collapsed', 'building_collapse_report'],
  ['छत खसेर दिदी थुनिनुभयो', 'trapped_debris_report'],
  ['gaun jana akidaina road band cha', 'road_blockage_report'],
  // Tier 3: ambiguous
  ['xyzabc 123 random', 'fallback_unclear'],
  ['', 'fallback_unclear'],
];

const BENCH_SAMPLES = [
  'namaste',
  'building collapsed',
  'छत खसेर दिदी थुनिनुभयो',
  'gaun jana akidaina road band cha',
  'what is the weather like',
];

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function testCommand() {
  console.log('\n' + '='.repeat(70));
  console.log('QSafe Offline NLU - Inference Testing');
  console.log('='.repeat(70));

  console.log('\nLoading model artifacts...');
  const engine = new IntentEngine();

  console.log(`\nTesting ${SAMPLES.length} sample queries...\n`);
  console.log(
    pad('Input Text', 44) + pad('Intent', 32) + pad('Confidence', 12) +
    pad('Source', 15) + 'Latency',
  );
  console.log('-'.repeat(115));

  let failures = 0;
  for (const [text, expected] of SAMPLES) {
    const r = engine.predict(text);
    if (r.intent !== expected) failures += 1;
    const shown = text.length > 42 ? `${text.slice(0, 39)}...` : text;
    console.log(
      pad(shown, 44) + pad(r.intent, 32) +
      pad(`${(r.confidence * 100).toFixed(2)}%`, 12) +
      pad(r.source, 15) + `${r.latency_ms.toFixed(2)} ms`,
    );
  }

  console.log('\n' + '='.repeat(70));
  if (failures === 0) {
    console.log('Testing complete - all samples matched their expected intent');
    return 0;
  }
  console.log(`Testing complete - ${failures}/${SAMPLES.length} samples did NOT match`);
  return 1;
}

function benchmarkCommand(iterations) {
  console.log('\n' + '='.repeat(70));
  console.log('QSafe Offline NLU - Latency Benchmark');
  console.log('='.repeat(70));

  console.log('\nLoading model artifacts...');
  const engine = new IntentEngine();

  // Warm up so JIT compilation is not billed to the measured run.
  for (let i = 0; i < 200; i += 1) {
    for (const sample of BENCH_SAMPLES) engine.predict(sample);
  }

  console.log(`\nRunning ${iterations} iterations over ${BENCH_SAMPLES.length} samples...`);
  const timings = [];
  const started = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) {
    for (const sample of BENCH_SAMPLES) {
      const t0 = process.hrtime.bigint();
      engine.predict(sample);
      timings.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
  }
  const totalSeconds = Number(process.hrtime.bigint() - started) / 1e9;

  timings.sort((a, b) => a - b);
  const at = (q) => timings[Math.min(timings.length - 1, Math.floor(timings.length * q))];
  const mean = timings.reduce((a, b) => a + b, 0) / timings.length;

  console.log('\nBenchmark results:');
  console.log(`  Total queries : ${timings.length}`);
  console.log(`  Total time    : ${totalSeconds.toFixed(4)} s`);
  console.log(`  Mean latency  : ${mean.toFixed(4)} ms`);
  console.log(`  Median (p50)  : ${at(0.5).toFixed(4)} ms`);
  console.log(`  p95           : ${at(0.95).toFixed(4)} ms`);
  console.log(`  p99           : ${at(0.99).toFixed(4)} ms`);

  if (mean < 5.0) {
    console.log('\nPASS: mean latency is under the 5ms/query target');
    return 0;
  }
  console.log('\nWARN: mean latency exceeds the 5ms/query target');
  return 0;
}

async function serveCommand() {
  await import('./server.js');
  return 0;
}

function usage() {
  console.log(`
QSafe Offline NLU Intent Classification Engine

Usage:
  node src/cli.js test                     Classify sample queries
  node src/cli.js benchmark [--iterations] Latency benchmark (default 1000)
  node src/cli.js serve                    Start the HTTP microservice
`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      iterations: { type: 'string', default: '1000' },
      help: { type: 'boolean', default: false },
    },
  });

  const command = positionals[0];
  if (values.help || !command) {
    usage();
    return command ? 0 : 1;
  }

  switch (command) {
    case 'test':
      return testCommand();
    case 'benchmark': {
      const iterations = Number.parseInt(values.iterations, 10);
      if (!Number.isInteger(iterations) || iterations <= 0) {
        console.error(`--iterations must be a positive integer, got "${values.iterations}"`);
        return 1;
      }
      return benchmarkCommand(iterations);
    }
    case 'serve':
      return serveCommand();
    default:
      console.error(`Unknown command: ${command}`);
      usage();
      return 1;
  }
}

process.exitCode = await main();

/**
 * Local benchmark for NFR-PERF-001 (p95 ≤ 100ms on a warm cache).
 * Not a CI gate. Requires a running API, Redis, and a public slug.
 *
 *   REDIS_URL=redis://127.0.0.1:6379 DATABASE_URL=... \
 *     pnpm exec tsx --conditions=@beacon-watch/source scripts/bench-public-status.ts \
 *     http://127.0.0.1:4000/api/public/v1/status/portfolio-demo
 */
const url = process.argv[2] ?? 'http://127.0.0.1:4000/api/public/v1/status/portfolio-demo';
const iterations = Number(process.argv[3] ?? 50);

async function timeOnce(): Promise<number> {
  const started = performance.now();
  const res = await globalThis.fetch(url);
  await res.arrayBuffer();
  return performance.now() - started;
}

await timeOnce();
const samples: number[] = [];
for (let i = 0; i < iterations; i += 1) {
  samples.push(await timeOnce());
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)] ?? 0;
process.stdout.write(`n=${samples.length} p95=${p95.toFixed(2)}ms (budget 100ms)\n`);
if (p95 > 100) process.exitCode = 1;

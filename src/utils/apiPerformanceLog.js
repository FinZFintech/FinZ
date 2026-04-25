import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lightweight API call performance log.
 *
 * Wraps any async function so we capture { api, durationMs, ok,
 * statusCode, errorMessage, at } per call. Persists the latest
 * MAX_ENTRIES events to AsyncStorage so the admin Api Health Monitor
 * can show a recent-history view across sessions.
 *
 * Usage:
 *   const result = await logApiCall('signzy.cibilConsumerReport',
 *     () => signzyService.cibilConsumerReport(payload));
 *
 * Failures still throw — the wrapper just records the timing + error
 * before re-raising. A timeout error (ApiTimeoutError) is recorded
 * with `timedOut: true`.
 */

const STORAGE_KEY = 'finz_api_perf_log_v1';
const MAX_ENTRIES = 200;
const SLOW_API_THRESHOLD_MS = 8000;

let inMemory = [];
let hydrated = false;

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) inMemory = JSON.parse(raw) || [];
  } catch (_) { /* ignore — start fresh */ }
}

async function persist() {
  try {
    if (inMemory.length > MAX_ENTRIES) inMemory = inMemory.slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(inMemory));
  } catch (_) { /* ignore — log is best-effort */ }
}

export async function logApiCall(apiName, fn, meta = {}) {
  await hydrate();
  const startedAt = Date.now();
  try {
    const out = await fn();
    const durationMs = Date.now() - startedAt;
    const entry = {
      api: apiName,
      ok: true,
      durationMs,
      at: new Date(startedAt).toISOString(),
      ...meta,
    };
    inMemory.push(entry);
    persist().catch(() => {});
    if (durationMs > SLOW_API_THRESHOLD_MS) {
      console.log(`[apiPerf] SLOW ${apiName}: ${durationMs}ms`);
    }
    return out;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const entry = {
      api: apiName,
      ok: false,
      durationMs,
      at: new Date(startedAt).toISOString(),
      timedOut: err?.name === 'ApiTimeoutError',
      statusCode: err?.statusCode || err?.response?.status || null,
      errorMessage: String(err?.message || err || '').slice(0, 240),
      ...meta,
    };
    inMemory.push(entry);
    persist().catch(() => {});
    console.log(`[apiPerf] FAIL ${apiName}: ${durationMs}ms — ${entry.errorMessage}`);
    throw err;
  }
}

/** Read the recent log (most-recent-last). */
export async function getApiPerfLog() {
  await hydrate();
  return [...inMemory];
}

/**
 * Aggregate stats per api name.
 *  { api, calls, failures, p50, p95, slowest, errorRate }
 */
export async function getApiPerfStats() {
  await hydrate();
  const byApi = {};
  for (const e of inMemory) {
    if (!byApi[e.api]) {
      byApi[e.api] = { api: e.api, calls: 0, failures: 0, durations: [], slowest: 0 };
    }
    const b = byApi[e.api];
    b.calls += 1;
    if (!e.ok) b.failures += 1;
    if (typeof e.durationMs === 'number') {
      b.durations.push(e.durationMs);
      if (e.durationMs > b.slowest) b.slowest = e.durationMs;
    }
  }
  return Object.values(byApi).map((b) => {
    const sorted = [...b.durations].sort((x, y) => x - y);
    const p = (q) => sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return {
      api: b.api,
      calls: b.calls,
      failures: b.failures,
      errorRate: b.calls === 0 ? 0 : b.failures / b.calls,
      p50: p(0.5),
      p95: p(0.95),
      slowest: b.slowest,
    };
  }).sort((a, b) => b.errorRate - a.errorRate || b.calls - a.calls);
}

/** Wipe the log (admin tool). */
export async function clearApiPerfLog() {
  inMemory = [];
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
}

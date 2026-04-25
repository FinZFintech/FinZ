/**
 * Wrap a promise in a wall-clock timeout. If the promise hasn't
 * resolved in `ms` milliseconds, the wrapper rejects with a tagged
 * timeout error so callers can:
 *   • render a method-failure banner with retry / switch CTAs,
 *   • log the slow API for performance monitoring (apiLog).
 *
 * The error carries `{ name: 'ApiTimeoutError', timeoutMs, label }` so
 * call sites can branch on `err.name === 'ApiTimeoutError'` without
 * relying on the message string. Concretely used by the KYC flows
 * (DigiLocker poll watchdog, Aadhaar XML upload), the income
 * verification flow (AA / Bank Statement), and the vKYC initiator.
 */
export function withTimeout(promise, ms, label = 'API call') {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => {
      const err = new Error(`${label} did not respond within ${Math.round(ms / 1000)}s.`);
      err.name = 'ApiTimeoutError';
      err.timeoutMs = ms;
      err.label = label;
      reject(err);
    }, ms);
  });
  // Race; clear the timer either way so we don't leak.
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(t)),
    timeout,
  ]);
}

export const FIVE_MINUTES_MS = 5 * 60 * 1000;

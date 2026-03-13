/**
 * Circuit Breaker for API resilience.
 *
 * States:
 *   CLOSED   — requests flow normally
 *   OPEN     — requests are blocked (fast-fail), returns fallback
 *   HALF_OPEN — one probe request allowed to test recovery
 *
 * Config:
 *   failureThreshold  — consecutive failures before opening (default: 3)
 *   resetTimeout      — ms before trying half-open (default: 30000)
 *   requestTimeout    — per-request timeout in ms (default: 15000)
 */

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeout = options.resetTimeout || 30000;
    this.requestTimeout = options.requestTimeout || 15000;

    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn, fallback = null) {
    if (this.state === STATES.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = STATES.HALF_OPEN;
      } else {
        return this._handleFallback(fallback, 'Circuit OPEN');
      }
    }

    try {
      const result = await this._withTimeout(fn());
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      return this._handleFallback(fallback, err.message);
    }
  }

  _withTimeout(promise) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout after ${this.requestTimeout}ms`)), this.requestTimeout);
      promise
        .then((val) => { clearTimeout(timer); resolve(val); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  }

  _onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    if (this.state === STATES.HALF_OPEN) {
      this.state = STATES.CLOSED;
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = STATES.OPEN;
    }
  }

  _handleFallback(fallback, reason) {
    if (fallback !== null && fallback !== undefined) {
      const value = typeof fallback === 'function' ? fallback(reason) : fallback;
      return { ...value, _circuitBroken: true, _fallbackReason: reason };
    }
    return null;
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
}

// ─── Registry of per-API circuit breakers ────────────────────────────────────

const breakers = {};

/**
 * Get or create a circuit breaker for an API.
 * @param {string} apiName - Unique API identifier (e.g., 'phoneIntelligence')
 * @param {object} options - Optional overrides for thresholds
 */
export function getBreaker(apiName, options = {}) {
  if (!breakers[apiName]) {
    breakers[apiName] = new CircuitBreaker(apiName, options);
  }
  return breakers[apiName];
}

/**
 * Wrap an async API call with circuit breaker protection.
 * @param {string} apiName - Breaker name
 * @param {Function} fn - Async function to execute
 * @param {*} fallback - Fallback value if circuit is open or call fails
 * @param {object} options - Circuit breaker options
 */
export async function withCircuitBreaker(apiName, fn, fallback = null, options = {}) {
  const breaker = getBreaker(apiName, options);
  return breaker.execute(fn, fallback);
}

/**
 * Get status of all circuit breakers.
 */
export function getAllBreakerStatuses() {
  const statuses = {};
  for (const [name, breaker] of Object.entries(breakers)) {
    statuses[name] = breaker.getStatus();
  }
  return statuses;
}

/**
 * Reset all circuit breakers (useful on app restart or session change).
 */
export function resetAllBreakers() {
  for (const breaker of Object.values(breakers)) {
    breaker.reset();
  }
}

export { CircuitBreaker, STATES };

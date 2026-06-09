export interface CircuitBreakerState {
  moduleId: string;
  failures: { timestamp: string }[];
  tripped: boolean;
  trippedAt?: string;
}

export interface CircuitBreakerConfig {
  threshold: number; // default 3
  windowMs: number; // default 15 * 60 * 1000
}

const DEFAULT_CONFIG: CircuitBreakerConfig = { threshold: 3, windowMs: 15 * 60 * 1000 };

export function createBreakerState(moduleId: string): CircuitBreakerState {
  return { moduleId, failures: [], tripped: false };
}

export function recordFailure(state: CircuitBreakerState, config = DEFAULT_CONFIG): CircuitBreakerState {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs).toISOString();

  const recentFailures = [
    ...state.failures.filter(f => f.timestamp >= windowStart),
    { timestamp: now.toISOString() },
  ];

  const tripped = recentFailures.length >= config.threshold;

  return {
    ...state,
    failures: recentFailures,
    tripped,
    trippedAt: tripped && !state.tripped ? now.toISOString() : state.trippedAt,
  };
}

export function recordSuccess(state: CircuitBreakerState): CircuitBreakerState {
  return { ...state, failures: [], tripped: false, trippedAt: undefined };
}

export function isBlocked(state: CircuitBreakerState): boolean {
  return state.tripped;
}

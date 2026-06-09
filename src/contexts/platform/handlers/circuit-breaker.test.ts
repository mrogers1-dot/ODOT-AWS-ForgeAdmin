import { describe, it, expect } from "vitest";
import {
  createBreakerState,
  recordFailure,
  recordSuccess,
  isBlocked,
  type CircuitBreakerConfig,
} from "./circuit-breaker";

describe("Circuit Breaker Service", () => {
  const config: CircuitBreakerConfig = { threshold: 3, windowMs: 15 * 60 * 1000 };

  it("error count below threshold keeps breaker closed", () => {
    let state = createBreakerState("module-a");
    state = recordFailure(state, config);
    state = recordFailure(state, config);

    expect(state.tripped).toBe(false);
    expect(isBlocked(state)).toBe(false);
  });

  it("3 failures in 15-min window trips breaker", () => {
    let state = createBreakerState("module-a");
    state = recordFailure(state, config);
    state = recordFailure(state, config);
    state = recordFailure(state, config);

    expect(state.tripped).toBe(true);
    expect(state.trippedAt).toBeDefined();
  });

  it("tripped breaker blocks execution", () => {
    let state = createBreakerState("module-a");
    state = recordFailure(state, config);
    state = recordFailure(state, config);
    state = recordFailure(state, config);

    expect(isBlocked(state)).toBe(true);
  });

  it("success resets failure count", () => {
    let state = createBreakerState("module-a");
    state = recordFailure(state, config);
    state = recordFailure(state, config);
    state = recordSuccess(state);

    expect(state.failures).toHaveLength(0);
    expect(state.tripped).toBe(false);
    expect(isBlocked(state)).toBe(false);
  });
});

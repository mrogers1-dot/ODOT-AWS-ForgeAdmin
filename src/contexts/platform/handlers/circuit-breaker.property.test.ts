import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createBreakerState, recordFailure, recordSuccess, isBlocked } from "./circuit-breaker";

describe("Circuit Breaker — Property Tests", () => {
  it("PROPERTY: after threshold failures, breaker ALWAYS trips", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        (failureCount) => {
          let state = createBreakerState("mod-test");
          for (let i = 0; i < failureCount; i++) {
            state = recordFailure(state, { threshold: 3, windowMs: 60 * 60 * 1000 });
          }
          expect(state.tripped).toBe(true);
          expect(isBlocked(state)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("PROPERTY: below threshold, breaker never trips", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 }),
        (failureCount) => {
          let state = createBreakerState("mod-test");
          for (let i = 0; i < failureCount; i++) {
            state = recordFailure(state, { threshold: 3, windowMs: 60 * 60 * 1000 });
          }
          expect(state.tripped).toBe(false);
          expect(isBlocked(state)).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("PROPERTY: success always resets to untripped", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (failureCount) => {
          let state = createBreakerState("mod-test");
          for (let i = 0; i < failureCount; i++) {
            state = recordFailure(state, { threshold: 3, windowMs: 60 * 60 * 1000 });
          }
          state = recordSuccess(state);
          expect(state.tripped).toBe(false);
          expect(isBlocked(state)).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });
});

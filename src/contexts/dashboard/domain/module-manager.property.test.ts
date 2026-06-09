import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { transitionState, type ModuleState } from "./module-manager";

const VALID_STATES = ["enabled", "disabled", "shadow"] as const;
type State = (typeof VALID_STATES)[number];

const arbState = fc.constantFrom<State>("enabled", "disabled", "shadow");

describe("Module State Machine — Property Tests", () => {
  it("PROPERTY: only valid transitions succeed — same state always fails", () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const current: ModuleState = { moduleId: "mod-prop", state };
        const result = transitionState(current, state);
        expect(result.success).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it("PROPERTY: every successful transition produces a new state in valid set", () => {
    fc.assert(
      fc.property(arbState, arbState, (from, to) => {
        const current: ModuleState = { moduleId: "mod-prop", state: from };
        const result = transitionState(current, to);
        if (result.success) {
          expect(VALID_STATES).toContain(result.newState!.state);
          expect(result.newState!.state).toBe(to);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("PROPERTY: transition results are deterministic — same input always same output", () => {
    fc.assert(
      fc.property(arbState, arbState, (from, to) => {
        const current: ModuleState = { moduleId: "mod-prop", state: from };
        const result1 = transitionState(current, to);
        const result2 = transitionState(current, to);
        expect(result1.success).toBe(result2.success);
        expect(result1.error).toBe(result2.error);
      }),
      { numRuns: 100 },
    );
  });
});

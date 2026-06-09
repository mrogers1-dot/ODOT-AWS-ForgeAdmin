import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { deriveGuardrails } from "./guardrail-rules";

describe("Feedback Guardrails — Property Tests", () => {
  it("PROPERTY: guardrail ceiling is always 0-100 or undefined", () => {
    fc.assert(
      fc.property(
        fc.record({
          consecutiveFailures: fc.integer({ min: 0, max: 20 }),
          successRate: fc.double({ min: 0, max: 1, noNaN: true }),
          totalPlans: fc.integer({ min: 0, max: 100 }),
        }),
        (input) => {
          const result = deriveGuardrails(input);
          if (result.confidenceCeiling !== undefined) {
            expect(result.confidenceCeiling).toBeGreaterThanOrEqual(0);
            expect(result.confidenceCeiling).toBeLessThanOrEqual(100);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("PROPERTY: ceiling >= floor when both exist", () => {
    fc.assert(
      fc.property(
        fc.record({
          consecutiveFailures: fc.integer({ min: 0, max: 20 }),
          successRate: fc.double({ min: 0, max: 1, noNaN: true }),
          totalPlans: fc.integer({ min: 0, max: 100 }),
        }),
        (input) => {
          const result = deriveGuardrails(input);
          if (result.confidenceCeiling !== undefined && result.confidenceFloor !== undefined) {
            expect(result.confidenceCeiling).toBeGreaterThanOrEqual(result.confidenceFloor);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

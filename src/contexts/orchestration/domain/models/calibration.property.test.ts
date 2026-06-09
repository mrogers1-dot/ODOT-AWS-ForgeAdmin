import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeCalibration, type ConfidenceOutcome } from "./calibration";

const arbOutcome: fc.Arbitrary<ConfidenceOutcome> = fc.record({
  confidence: fc.integer({ min: 0, max: 100 }),
  success: fc.boolean(),
});

describe("Calibration Computation — Property Tests", () => {
  it("PROPERTY: Brier score is always between 0 and 1 inclusive", () => {
    fc.assert(
      fc.property(
        fc.array(arbOutcome, { minLength: 1, maxLength: 50 }),
        (outcomes) => {
          const result = computeCalibration(outcomes);
          expect(result.brierScore).toBeGreaterThanOrEqual(0);
          expect(result.brierScore).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("PROPERTY: output always contains exactly 5 CalibrationPoints", () => {
    fc.assert(
      fc.property(
        fc.array(arbOutcome, { minLength: 0, maxLength: 30 }),
        (outcomes) => {
          const result = computeCalibration(outcomes);
          expect(result.points).toHaveLength(5);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("PROPERTY: deviation = predictedMean - actualSuccessRate for every point", () => {
    fc.assert(
      fc.property(
        fc.array(arbOutcome, { minLength: 5, maxLength: 50 }),
        (outcomes) => {
          const result = computeCalibration(outcomes);
          for (const point of result.points) {
            if (point.sampleSize > 0) {
              const expectedDeviation = point.predictedMean - point.actualSuccessRate;
              expect(Math.abs(point.deviation - expectedDeviation)).toBeLessThan(0.002);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

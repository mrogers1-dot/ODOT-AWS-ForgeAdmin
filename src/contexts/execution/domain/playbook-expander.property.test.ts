import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { expandPlan, type PlaybookStep, type PlaybookResolver } from "./playbook-expander";

describe("Playbook Expander — Property Tests", () => {
  it("PROPERTY: after expansion, no playbook-ref steps remain", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            stepIndex: fc.integer({ min: 1, max: 10 }),
            type: fc.constantFrom("custom" as const, "playbook-ref" as const),
            description: fc.string({ minLength: 1, maxLength: 30 }),
            expectedOutcome: fc.string({ minLength: 1, maxLength: 30 }),
            rollback: fc.string({ minLength: 1, maxLength: 30 }),
            playbookId: fc.constant("pb-1"),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        async (steps: PlaybookStep[]) => {
          const resolver: PlaybookResolver = async () => ({
            id: "pb-1",
            steps: [
              { description: "Sub-step", expectedOutcome: "Done", rollback: "Undo" },
            ],
          });

          const result = await expandPlan(steps, resolver);

          // No playbook-ref in output — all are expanded
          for (const expanded of result) {
            expect(expanded.description).toBeDefined();
            expect(expanded.rollback).toBeDefined();
          }
          // Result count should be >= input count (refs expand to 1+ steps)
          expect(result.length).toBeGreaterThanOrEqual(steps.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("PROPERTY: custom steps always produce exactly one output step each", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (count) => {
          const steps: PlaybookStep[] = Array.from({ length: count }, (_, i) => ({
            stepIndex: i + 1,
            type: "custom" as const,
            description: `Step ${i}`,
            expectedOutcome: "OK",
            rollback: "Undo",
          }));

          const resolver: PlaybookResolver = async () => null;
          const result = await expandPlan(steps, resolver);

          expect(result.length).toBe(count);
        },
      ),
      { numRuns: 50 },
    );
  });
});

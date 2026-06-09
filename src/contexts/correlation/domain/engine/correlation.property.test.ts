import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { evaluateRules, type EvaluationInput } from "./rule-evaluator";
import type { CorrelationRule } from "../models/correlation-rule";

const arbRule: fc.Arbitrary<CorrelationRule> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.constantFrom("temporal" as const, "infrastructure" as const, "causal" as const, "repeat" as const),
  matchAttributes: fc.array(
    fc.record({
      field: fc.constantFrom("affectedSystem", "category", "title"),
      matchType: fc.constantFrom("exact" as const),
    }),
    { minLength: 1, maxLength: 2 },
  ),
  window: fc.record({ gapSeconds: fc.integer({ min: 60, max: 3600 }) }),
  minItems: fc.integer({ min: 2, max: 5 }),
  action: fc.constantFrom("merge" as const, "enrich" as const),
  priority: fc.integer({ min: 1, max: 100 }),
  enabled: fc.constant(true),
});

describe("Correlation Engine — Property Tests", () => {
  it("PROPERTY: determinism — same inputs always produce same result", () => {
    fc.assert(
      fc.property(fc.array(arbRule, { minLength: 0, maxLength: 5 }), (rules) => {
        const input: EvaluationInput = {
          affectedSystem: "web-01",
          __expected_affectedSystem: "web-01",
          category: "health",
          __expected_category: "health",
        };
        const result1 = evaluateRules(rules, input);
        const result2 = evaluateRules(rules, input);
        expect(result1.matchedRule?.id).toBe(result2.matchedRule?.id);
        expect(result1.matchKey).toBe(result2.matchKey);
      }),
      { numRuns: 100 },
    );
  });

  it("PROPERTY: at most one match — evaluateRules returns at most one rule", () => {
    fc.assert(
      fc.property(fc.array(arbRule, { minLength: 1, maxLength: 10 }), (rules) => {
        const input: EvaluationInput = {
          affectedSystem: "web-01",
          __expected_affectedSystem: "web-01",
        };
        const result = evaluateRules(rules, input);
        // Result is either null or exactly one rule
        if (result.matchedRule) {
          expect(typeof result.matchedRule.id).toBe("string");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("PROPERTY: empty rules always returns null", () => {
    fc.assert(
      fc.property(
        fc.record({ affectedSystem: fc.string(), __expected_affectedSystem: fc.string() }),
        (input) => {
          const result = evaluateRules([], input as EvaluationInput);
          expect(result.matchedRule).toBeNull();
          expect(result.matchKey).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });
});

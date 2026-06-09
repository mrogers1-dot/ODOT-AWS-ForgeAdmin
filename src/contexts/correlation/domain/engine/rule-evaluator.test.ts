import { describe, it, expect } from "vitest";
import { evaluateRules } from "./rule-evaluator";
import type { CorrelationRule } from "../models/correlation-rule";
import type { EvaluationInput } from "./rule-evaluator";

function makeRule(overrides?: Partial<CorrelationRule>): CorrelationRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    type: "temporal",
    matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    window: { gapSeconds: 300 },
    minItems: 2,
    action: "merge",
    priority: 1,
    enabled: true,
    ...overrides,
  };
}

describe("Correlation Rule Evaluator", () => {
  it("exact match correctly identifies matching rule", () => {
    const rule = makeRule({
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    });

    const input: EvaluationInput = {
      affectedSystem: "web-01",
      __expected_affectedSystem: "web-01",
    };

    const result = evaluateRules([rule], input);
    expect(result.matchedRule).not.toBeNull();
    expect(result.matchedRule!.id).toBe("rule-1");
    expect(result.matchKey).toBe("web-01");
  });

  it("fuzzy match with threshold 0.8 matches similar strings", () => {
    const rule = makeRule({
      id: "rule-fuzzy",
      matchAttributes: [{ field: "title", matchType: "fuzzy", threshold: 0.8 }],
    });

    const input: EvaluationInput = {
      title: "disk full on server",
      __expected_title: "disk full on server",
    };

    const result = evaluateRules([rule], input);
    expect(result.matchedRule).not.toBeNull();
    expect(result.matchedRule!.id).toBe("rule-fuzzy");
  });

  it("rules evaluated in priority order (lower priority number = first)", () => {
    const lowPriority = makeRule({
      id: "rule-low",
      priority: 10,
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    });
    const highPriority = makeRule({
      id: "rule-high",
      priority: 1,
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    });

    const input: EvaluationInput = {
      affectedSystem: "web-01",
      __expected_affectedSystem: "web-01",
    };

    // Pass low priority first to verify sorting
    const result = evaluateRules([lowPriority, highPriority], input);
    expect(result.matchedRule!.id).toBe("rule-high");
  });

  it("first matching rule wins", () => {
    const rule1 = makeRule({
      id: "rule-first",
      priority: 1,
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    });
    const rule2 = makeRule({
      id: "rule-second",
      priority: 2,
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    });

    const input: EvaluationInput = {
      affectedSystem: "web-01",
      __expected_affectedSystem: "web-01",
    };

    const result = evaluateRules([rule1, rule2], input);
    expect(result.matchedRule!.id).toBe("rule-first");
  });

  it("no match returns null", () => {
    const rule = makeRule({
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    });

    const input: EvaluationInput = {
      affectedSystem: "web-01",
      __expected_affectedSystem: "db-01",
    };

    const result = evaluateRules([rule], input);
    expect(result.matchedRule).toBeNull();
    expect(result.matchKey).toBeNull();
  });

  it("malformed rule is skipped (doesn't throw)", () => {
    const validRule = makeRule({
      id: "valid-rule",
      priority: 2,
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    });
    const malformedRule = {
      id: null,
      priority: undefined,
      matchAttributes: null,
    } as unknown as CorrelationRule;

    const input: EvaluationInput = {
      affectedSystem: "web-01",
      __expected_affectedSystem: "web-01",
    };

    expect(() => evaluateRules([malformedRule, validRule], input)).not.toThrow();
    const result = evaluateRules([malformedRule, validRule], input);
    expect(result.matchedRule!.id).toBe("valid-rule");
  });
});

import { describe, it, expect } from "vitest";
import { deriveGuardrails } from "./guardrail-rules";

describe("Guardrail Rules", () => {
  it("5 consecutive failures sets ceiling to 40", () => {
    const result = deriveGuardrails({ consecutiveFailures: 5, successRate: 0.5, totalPlans: 10 });

    expect(result.confidenceCeiling).toBe(40);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.reason).toContain("consecutive failures");
  });

  it("success rate < 30% sets ceiling to 50", () => {
    const result = deriveGuardrails({ consecutiveFailures: 2, successRate: 0.2, totalPlans: 10 });

    expect(result.confidenceCeiling).toBe(50);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.reason).toContain("30%");
  });

  it("no issues returns no guardrails (ceiling undefined)", () => {
    const result = deriveGuardrails({ consecutiveFailures: 1, successRate: 0.8, totalPlans: 10 });

    expect(result.confidenceCeiling).toBeUndefined();
    expect(result.requiresHumanReview).toBe(false);
  });
});

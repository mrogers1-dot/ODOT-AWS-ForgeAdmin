import { describe, it, expect } from "vitest";
import { createExecutionPlan } from "./execution-plan";

describe("ExecutionPlan", () => {
  it("creates a plan with valid steps", () => {
    const plan = createExecutionPlan({
      workItemId: "wi-001",
      steps: [
        { stepIndex: 1, description: "Reset password", expectedOutcome: "Password changed", rollback: "Revert to old password" },
      ],
      confidenceScore: 80,
      justification: "KB item KB-001 matches scenario exactly",
    });
    expect(plan.steps).toHaveLength(1);
    expect(plan.planId).toBeDefined();
  });

  it("rejects plans with more than 20 steps", () => {
    const steps = Array.from({ length: 21 }, (_, i) => ({
      stepIndex: i + 1,
      description: `Step ${i + 1}`,
      expectedOutcome: "OK",
      rollback: "Undo",
    }));
    expect(() =>
      createExecutionPlan({ workItemId: "wi-002", steps, confidenceScore: 50, justification: "test" }),
    ).toThrow("cannot exceed 20 steps");
  });

  it("rejects plans with zero steps", () => {
    expect(() =>
      createExecutionPlan({ workItemId: "wi-003", steps: [], confidenceScore: 50, justification: "test" }),
    ).toThrow();
  });
});

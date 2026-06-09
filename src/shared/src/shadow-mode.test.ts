import { describe, it, expect } from "vitest";
import { processShadow, type ShadowInput } from "./shadow-mode";

describe("Shadow Mode", () => {
  it("logs proposed actions without executing", () => {
    const input: ShadowInput = {
      workItemId: "wi-001",
      moduleId: "mod-1",
      proposedPlan: { steps: ["step1", "step2"], confidence: 85 },
    };

    const result = processShadow(input);

    expect(result.executed).toBe(false);
    expect(result.record.workItemId).toBe("wi-001");
    expect(result.record.proposedActions).toEqual(["step1", "step2"]);
    expect(result.record.confidenceScore).toBe(85);
    expect(result.record.recordedAt).toBeDefined();
  });

  it("shadow record includes module context", () => {
    const input: ShadowInput = {
      workItemId: "wi-002",
      moduleId: "mod-ad-unlock",
      proposedPlan: { steps: ["Unlock AD account"], confidence: 92 },
    };

    const result = processShadow(input);

    expect(result.record.moduleId).toBe("mod-ad-unlock");
  });

  it("never produces side effects (executed is always false)", () => {
    const inputs: ShadowInput[] = [
      { workItemId: "a", moduleId: "m1", proposedPlan: { steps: [], confidence: 100 } },
      { workItemId: "b", moduleId: "m2", proposedPlan: { steps: ["x"], confidence: 0 } },
    ];

    for (const input of inputs) {
      expect(processShadow(input).executed).toBe(false);
    }
  });
});

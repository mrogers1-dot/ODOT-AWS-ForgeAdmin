import { describe, it, expect } from "vitest";
import { supervise } from "./supervisor";
import type { SupervisorInput } from "./supervisor";

describe("Supervisor Agent", () => {
  it("routes medium risk to approval gate", () => {
    const input: SupervisorInput = {
      riskLevel: "medium",
      confidenceScore: 90,
    };
    const result = supervise(input);
    expect(result.route).toBe("approval");
    expect(result.reason).toContain("Risk=medium");
  });

  it("routes high risk to approval gate", () => {
    const input: SupervisorInput = {
      riskLevel: "high",
      confidenceScore: 95,
    };
    const result = supervise(input);
    expect(result.route).toBe("approval");
    expect(result.reason).toContain("Risk=high");
  });

  it("auto-executes when low risk and confidence > 70", () => {
    const input: SupervisorInput = {
      riskLevel: "low",
      confidenceScore: 85,
    };
    const result = supervise(input);
    expect(result.route).toBe("auto-execute");
    expect(result.reason).toContain("Low risk");
    expect(result.reason).toContain("85");
  });

  it("routes to approval when low risk but confidence <= 70", () => {
    const input: SupervisorInput = {
      riskLevel: "low",
      confidenceScore: 70,
    };
    const result = supervise(input);
    expect(result.route).toBe("approval");
    expect(result.reason).toContain("confidence=70");
  });

  it("produces cancel result on rejection", () => {
    const input: SupervisorInput = {
      riskLevel: "low",
      confidenceScore: 90,
      approvalStatus: "rejected",
    };
    const result = supervise(input);
    expect(result.route).toBe("cancel");
    expect(result.reason).toContain("rejected");
  });
});

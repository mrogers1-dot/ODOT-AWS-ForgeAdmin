import { describe, it, expect } from "vitest";
import { verify } from "./verification";
import type { StepOutcome } from "./verification";

describe("Verification Agent", () => {
  it("all steps matching expected outcome → result is pass", () => {
    const outcomes: StepOutcome[] = [
      { stepIndex: 0, expectedOutcome: "Service restarted", actualOutcome: "Service restarted" },
      { stepIndex: 1, expectedOutcome: "Health check green", actualOutcome: "Health check green" },
    ];

    const result = verify(outcomes);

    expect(result.overallResult).toBe("pass");
    expect(result.flaggedForReview).toBe(false);
    expect(result.stepResults.every((s) => s.result === "pass")).toBe(true);
  });

  it("any mismatch → result is fail with flaggedForReview=true", () => {
    const outcomes: StepOutcome[] = [
      { stepIndex: 0, expectedOutcome: "Service restarted", actualOutcome: "Service restarted" },
      { stepIndex: 1, expectedOutcome: "Health check green", actualOutcome: "Health check failed" },
    ];

    const result = verify(outcomes);

    expect(result.overallResult).toBe("fail");
    expect(result.flaggedForReview).toBe(true);
    expect(result.stepResults[1].result).toBe("fail");
  });

  it("all-pass produces resolution details for ServiceNow update", () => {
    const outcomes: StepOutcome[] = [
      { stepIndex: 0, expectedOutcome: "Disk cleaned", actualOutcome: "Disk cleaned" },
      { stepIndex: 1, expectedOutcome: "Service healthy", actualOutcome: "Service healthy" },
    ];

    const result = verify(outcomes);

    expect(result.overallResult).toBe("pass");
    expect(result.resolutionSummary).toBeDefined();
    expect(result.resolutionSummary!.length).toBeGreaterThan(0);
  });
});

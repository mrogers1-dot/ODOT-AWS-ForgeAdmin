import { describe, it, expect } from "vitest";
import { generateRunbook } from "./runbook-generator";
import type { RunbookInput } from "./runbook-generator";

describe("Runbook Generator", () => {
  it("generates runbook with required sections", () => {
    const input: RunbookInput = {
      workItemId: "wi-001",
      title: "Restart Web Service",
      resolutionSteps: ["Stop the service", "Clear cache", "Restart the service"],
      category: "health_remediation",
    };

    const runbook = generateRunbook(input);

    expect(runbook.runbookId).toBeDefined();
    expect(runbook.title).toBe("Restart Web Service");
    expect(runbook.prerequisites.length).toBeGreaterThan(0);
    expect(runbook.procedure).toEqual(["Stop the service", "Clear cache", "Restart the service"]);
    expect(runbook.expectedOutcomes.length).toBeGreaterThan(0);
    expect(runbook.rollbackSteps.length).toBeGreaterThan(0);
    expect(runbook.flaggedForReview).toBe(false);
  });

  it("publishes runbook.generated event structure", () => {
    const input: RunbookInput = {
      workItemId: "wi-002",
      title: "DNS Record Update",
      resolutionSteps: ["Validate record", "Apply change"],
      category: "account_service_request",
    };

    const runbook = generateRunbook(input);

    // Verify event-compatible shape
    expect(runbook).toMatchObject({
      runbookId: expect.any(String),
      title: "DNS Record Update",
      applicableTypes: ["account_service_request"],
      procedure: ["Validate record", "Apply change"],
    });
  });

  it("handles missing data gracefully (flags for review)", () => {
    const input: RunbookInput = {
      workItemId: "wi-003",
      title: "",
      resolutionSteps: [],
      category: "knowledge_capture",
    };

    const runbook = generateRunbook(input);

    expect(runbook.title).toBe("[Untitled Runbook]");
    expect(runbook.flaggedForReview).toBe(true);
    expect(runbook.procedure[0]).toContain("manual review required");
    expect(runbook.prerequisites[0]).toContain("Manual review required");
  });
});

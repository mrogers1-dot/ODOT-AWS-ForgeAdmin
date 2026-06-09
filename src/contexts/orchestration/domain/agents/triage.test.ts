import { describe, it, expect } from "vitest";
import { triage } from "./triage";
import type { OrchestrationWorkItem } from "../models/work-item";

const baseItem: OrchestrationWorkItem = {
  workItemId: "wi-001",
  sourceSystem: "servicenow",
  originalId: "INC001",
  title: "AD account locked out",
  description: "User john.doe locked out after multiple failed attempts",
  affectedSystem: "dc-01.dot.ohio.gov",
  reporter: "helpdesk",
  sourceTimestamp: "2026-06-09T08:00:00Z",
};

describe("Triage Agent", () => {
  it("produces exactly one category, one risk level, one urgency level", () => {
    const result = triage(baseItem);
    expect(result.category).toBeDefined();
    expect(["account_service_request", "health_remediation", "security_alert", "knowledge_capture"]).toContain(result.category);
    expect(["low", "medium", "high"]).toContain(result.riskLevel);
    expect(["critical", "high", "normal", "low"]).toContain(result.urgencyLevel);
  });

  it("defaults to high risk/high urgency when attributes are missing", () => {
    const sparse: OrchestrationWorkItem = {
      workItemId: "wi-002",
      sourceSystem: "email",
      originalId: "msg-001",
      title: "",
      description: "",
      sourceTimestamp: "2026-06-09T08:00:00Z",
    };

    const result = triage(sparse);
    expect(result.riskLevel).toBe("high");
    expect(result.urgencyLevel).toBe("high");
    expect(result.justification).toContain("missing");
  });

  it("justification references input attributes", () => {
    const result = triage(baseItem);
    expect(result.justification.length).toBeGreaterThan(0);
    // Should reference something from the work item
    expect(
      result.justification.toLowerCase().includes("account") ||
      result.justification.toLowerCase().includes("locked") ||
      result.justification.toLowerCase().includes("dc-01")
    ).toBe(true);
  });

  it("classifies security alerts from FortiSIEM", () => {
    const siemItem: OrchestrationWorkItem = {
      ...baseItem,
      sourceSystem: "fortisiem",
      title: "Brute Force Login Attempt",
      description: "50 failed login attempts from external IP",
      priority: "HIGH",
    };
    const result = triage(siemItem);
    expect(result.category).toBe("security_alert");
  });

  it("classifies health remediation for disk/memory/service issues", () => {
    const healthItem: OrchestrationWorkItem = {
      ...baseItem,
      title: "Disk usage critical on web-server-01",
      description: "Disk /var at 95% capacity, services degrading",
    };
    const result = triage(healthItem);
    expect(result.category).toBe("health_remediation");
  });
});

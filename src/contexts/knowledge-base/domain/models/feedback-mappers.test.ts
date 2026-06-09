import { describe, it, expect } from "vitest";
import {
  mapApprovalDecision,
  mapExecutionCompleted,
  mapExecutionFailed,
} from "./feedback-mappers";
import type {
  ApprovalDecisionEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
} from "./feedback-mappers";

const baseApprovalEvent: ApprovalDecisionEvent = {
  workItemId: "wi-001",
  planId: "plan-001",
  category: "health_remediation",
  riskLevel: "low",
  decision: "approved",
  confidenceAtDecision: 85,
  planStepCount: 3,
  kbItemsUsed: ["kb-1", "kb-2"],
  timestamp: "2026-06-09T10:00:00Z",
};

const baseExecutionCompleted: ExecutionCompletedEvent = {
  workItemId: "wi-002",
  planId: "plan-002",
  category: "account_service_request",
  riskLevel: "low",
  confidenceAtDecision: 90,
  planStepCount: 2,
  kbItemsUsed: ["kb-3"],
  timestamp: "2026-06-09T11:00:00Z",
};

const baseExecutionFailed: ExecutionFailedEvent = {
  workItemId: "wi-003",
  planId: "plan-003",
  category: "health_remediation",
  riskLevel: "medium",
  confidenceAtDecision: 65,
  planStepCount: 4,
  kbItemsUsed: ["kb-4"],
  failureDetail: "Service restart timed out",
  timestamp: "2026-06-09T12:00:00Z",
};

describe("Feedback Mappers", () => {
  it("maps approval.decision approved event to positive FeedbackEntry", () => {
    const entry = mapApprovalDecision(baseApprovalEvent);

    expect(entry.id).toBeDefined();
    expect(entry.workItemId).toBe("wi-001");
    expect(entry.planId).toBe("plan-001");
    expect(entry.signal).toBe("positive");
    expect(entry.outcomeType).toBe("approved");
    expect(entry.module).toBe("approval");
    expect(entry.confidenceAtDecision).toBe(85);
  });

  it("maps approval.decision rejected event to negative FeedbackEntry", () => {
    const rejectedEvent: ApprovalDecisionEvent = {
      ...baseApprovalEvent,
      decision: "rejected",
      rejectionReason: "Plan too risky for automated execution",
    };

    const entry = mapApprovalDecision(rejectedEvent);

    expect(entry.signal).toBe("negative");
    expect(entry.outcomeType).toBe("rejected");
    expect(entry.rejectionReason).toBe("Plan too risky for automated execution");
  });

  it("maps execution.completed event to positive FeedbackEntry", () => {
    const entry = mapExecutionCompleted(baseExecutionCompleted);

    expect(entry.id).toBeDefined();
    expect(entry.workItemId).toBe("wi-002");
    expect(entry.planId).toBe("plan-002");
    expect(entry.signal).toBe("positive");
    expect(entry.outcomeType).toBe("succeeded");
    expect(entry.module).toBe("execution");
    expect(entry.confidenceAtDecision).toBe(90);
  });

  it("maps execution.failed event to negative FeedbackEntry", () => {
    const entry = mapExecutionFailed(baseExecutionFailed);

    expect(entry.id).toBeDefined();
    expect(entry.workItemId).toBe("wi-003");
    expect(entry.planId).toBe("plan-003");
    expect(entry.signal).toBe("negative");
    expect(entry.outcomeType).toBe("failed");
    expect(entry.module).toBe("execution");
    expect(entry.failureDetail).toBe("Service restart timed out");
  });
});

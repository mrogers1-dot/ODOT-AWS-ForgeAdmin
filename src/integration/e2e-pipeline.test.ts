/**
 * Integration Tests — End-to-End Event Flow
 *
 * Validates the full ForgeAdmin pipeline from ingestion through resolution,
 * wiring all domain logic across bounded contexts.
 */

import { describe, it, expect, vi } from "vitest";

// Ingestion
import { normalizeServiceNow } from "../contexts/ingestion/normalizer";
import { createWorkItemCreatedEvent } from "../contexts/ingestion/publisher";

// Orchestration — agents
import { triage } from "../contexts/orchestration/domain/agents/triage";
import { research } from "../contexts/orchestration/domain/agents/research";
import { plan } from "../contexts/orchestration/domain/agents/planning";
import { verify } from "../contexts/orchestration/domain/agents/verification";
import { supervise } from "../contexts/orchestration/domain/agents/supervisor";

// Execution
import { executeOrchestration } from "../contexts/execution/domain/execution-orchestrator";

// Correlation
import { evaluateRules } from "../contexts/correlation/domain/engine/rule-evaluator";
import { finalizeSession } from "../contexts/correlation/domain/engine/group-finalizer";

// Platform
import { recordFailure, createBreakerState, isBlocked } from "../contexts/platform/handlers/circuit-breaker";
import { processShadow } from "../shared/src/shadow-mode";
import { markDegraded, markRecovered } from "../contexts/platform/handlers/degradation-monitor";

// Contract validation
import { validateEvent } from "../shared/src/contract-validator";

describe("E2E Pipeline — Happy Path", () => {
  it("work-item.created → triage → research → planning → approval → execution → verification → resolution", async () => {
    // === INGESTION ===
    const snPayload = {
      number: "INC0099999",
      short_description: "AD account locked - jsmith",
      description: "User jsmith locked out after 5 failed attempts on dc-01",
      priority: "2",
      urgency: "2",
      cmdb_ci: "dc-01.dot.ohio.gov",
      opened_by: "helpdesk",
      opened_at: "2026-06-09T08:00:00Z",
    };

    const workItem = normalizeServiceNow(snPayload);
    expect(workItem.sourceSystem).toBe("servicenow");
    expect(workItem.originalId).toBe("INC0099999");

    // Publish event
    const event = createWorkItemCreatedEvent(workItem);
    expect(event.detailType).toBe("work-item.created");

    // Validate against contract
    const validation = validateEvent("ingestion/work-item.created", event);
    expect(validation.valid).toBe(true);

    // === TRIAGE ===
    const triageResult = triage({
      ...workItem,
      workItemId: workItem.workItemId,
    });
    expect(triageResult.category).toBe("account_service_request");
    expect(triageResult.riskLevel).toBeDefined();
    expect(triageResult.urgencyLevel).toBeDefined();

    // === RESEARCH ===
    const mockKb = {
      query: vi.fn().mockResolvedValue([
        { itemId: "kb-101", title: "AD Unlock Procedure", content: "Steps to unlock AD accounts", category: "account_service_request", relevanceScore: 0.92 },
        { itemId: "kb-102", title: "Account Lockout Investigation", content: "Root cause analysis", category: "account_service_request", relevanceScore: 0.78 },
      ]),
    };

    const researchResult = await research(mockKb, triageResult.category, ["locked", "account", "AD"]);
    expect(researchResult.items.length).toBeGreaterThan(0);
    expect(researchResult.knowledgeGap).toBe(false);
    expect(researchResult.kbUnavailable).toBe(false);

    // === PLANNING ===
    const planResult = plan({
      workItemId: workItem.workItemId,
      category: triageResult.category,
      researchResult,
      serviceNowTicketId: "INC0099999",
    });
    expect(planResult.escalated).toBe(false);
    expect(planResult.plan).not.toBeNull();
    expect(planResult.plan!.steps.length).toBeGreaterThan(0);
    expect(planResult.confidence.value).toBeGreaterThan(30);

    // === SUPERVISOR — APPROVAL ROUTING ===
    const decision = supervise({
      riskLevel: triageResult.riskLevel,
      confidenceScore: planResult.confidence.value,
    });
    // Low risk + high confidence = auto-execute, otherwise approval
    expect(["approval", "auto-execute"]).toContain(decision.route);

    // === EXECUTION ===
    const executeCmd = vi.fn().mockResolvedValue({ stepIndex: 0, success: true, output: "Account unlocked" });

    const execResult = await executeOrchestration(
      planResult.plan!.steps.map((s) => ({
        stepIndex: s.stepIndex,
        command: `Unlock-ADAccount -Identity jsmith`,
        expectedOutcome: s.expectedOutcome,
        rollback: s.rollback,
      })),
      executeCmd,
    );
    expect(execResult.success).toBe(true);
    expect(execResult.stepsCompleted).toBe(planResult.plan!.steps.length);

    // === VERIFICATION ===
    const verificationResult = verify(
      planResult.plan!.steps.map((s) => ({
        stepIndex: s.stepIndex,
        expectedOutcome: s.expectedOutcome,
        actualOutcome: s.expectedOutcome, // All match in happy path
      })),
    );
    expect(verificationResult.overallResult).toBe("pass");
    expect(verificationResult.flaggedForReview).toBe(false);
    expect(verificationResult.resolutionSummary).toBeDefined();
  });
});

describe("E2E Pipeline — Circuit Breaker Trip", () => {
  it("circuit breaker trip halts execution and routes to humans", () => {
    let state = createBreakerState("mod-ad-unlock");

    // 3 failures trips the breaker
    state = recordFailure(state);
    state = recordFailure(state);
    state = recordFailure(state);

    expect(state.tripped).toBe(true);
    expect(isBlocked(state)).toBe(true);

    // Supervisor sees blocked module — would route to human
    // (In real system, this check happens before execution dispatch)
  });
});

describe("E2E Pipeline — Shadow Mode", () => {
  it("shadow mode logs proposed actions without execution", () => {
    const shadowResult = processShadow({
      workItemId: "wi-shadow-001",
      moduleId: "mod-ad-unlock",
      proposedPlan: {
        steps: ["Unlock-ADAccount -Identity jdoe", "Verify account status"],
        confidence: 88,
      },
    });

    expect(shadowResult.executed).toBe(false);
    expect(shadowResult.record.proposedActions).toHaveLength(2);
    expect(shadowResult.record.confidenceScore).toBe(88);
  });
});

describe("E2E Pipeline — Degradation + Recovery", () => {
  it("degradation marks component, recovery clears and logs duration", () => {
    const degraded = markDegraded("orchestration-triage");
    expect(degraded.status).toBe("degraded");
    expect(degraded.degradedSince).toBeDefined();

    const recovered = markRecovered(degraded);
    expect(recovered.status).toBe("healthy");
    expect(recovered.recoveredAt).toBeDefined();
    expect(recovered.totalDegradedMs).toBeGreaterThanOrEqual(0);
  });
});

describe("E2E Pipeline — Correlation Group Detection", () => {
  it("multiple related items form a correlation group", () => {
    const rule = {
      id: "temporal-lockout",
      name: "AD Lockout Burst",
      type: "temporal" as const,
      matchAttributes: [{ field: "affectedSystem", matchType: "exact" as const }],
      window: { gapSeconds: 300 },
      minItems: 3,
      action: "merge" as const,
      priority: 10,
      enabled: true,
    };

    // Simulate 3 items hitting the finalizer
    const session = {
      sessionId: "sess-int-001",
      ruleId: "temporal-lockout",
      matchKey: "dc-01",
      status: "open" as const,
      items: ["wi-001", "wi-002", "wi-003"],
      openedAt: "2026-06-09T08:00:00Z",
      lastActivityAt: "2026-06-09T08:04:00Z",
    };

    const result = finalizeSession(session, rule);

    expect(result.formed).toBe(true);
    expect(result.group).toBeDefined();
    expect(result.group!.memberItems).toHaveLength(3);
    expect(result.group!.action).toBe("merge");
    expect(result.group!.parentWorkItem).toBeDefined();
  });
});

describe("E2E Pipeline — Plan Rejection Halts Execution", () => {
  it("rejected plan produces cancel decision from supervisor", () => {
    const decision = supervise({
      riskLevel: "high",
      confidenceScore: 75,
      approvalStatus: "rejected",
    });

    expect(decision.route).toBe("cancel");
    expect(decision.reason).toContain("rejected");
  });
});

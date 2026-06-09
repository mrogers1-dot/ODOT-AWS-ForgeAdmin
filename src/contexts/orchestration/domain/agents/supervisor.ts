/**
 * Supervisor Agent — routes work items to approval gate or auto-execution
 * based on risk level and confidence score.
 */

export interface SupervisorInput {
  riskLevel: "low" | "medium" | "high";
  confidenceScore: number;
  confidenceThreshold?: number; // default 70
  approvalStatus?: "pending" | "approved" | "rejected";
}

export interface SupervisorDecision {
  route: "approval" | "auto-execute" | "cancel";
  reason: string;
}

export function supervise(input: SupervisorInput): SupervisorDecision {
  const threshold = input.confidenceThreshold ?? 70;

  if (input.approvalStatus === "rejected") {
    return { route: "cancel", reason: "Plan was rejected by approver." };
  }

  if (input.riskLevel === "low" && input.confidenceScore > threshold) {
    return {
      route: "auto-execute",
      reason: `Low risk, confidence ${input.confidenceScore} exceeds threshold ${threshold}.`,
    };
  }

  return {
    route: "approval",
    reason: `Risk=${input.riskLevel}, confidence=${input.confidenceScore}. Routing to approval gate.`,
  };
}

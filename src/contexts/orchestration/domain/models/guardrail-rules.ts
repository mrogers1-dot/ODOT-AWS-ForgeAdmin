import type { GuardrailConfig } from "./feedback-summary";

export interface GuardrailInput {
  consecutiveFailures: number;
  successRate: number;
  totalPlans: number;
}

export function deriveGuardrails(input: GuardrailInput): GuardrailConfig {
  if (input.consecutiveFailures >= 5) {
    return { confidenceCeiling: 40, requiresHumanReview: true, reason: "5+ consecutive failures" };
  }
  if (input.totalPlans >= 5 && input.successRate < 0.3) {
    return { confidenceCeiling: 50, requiresHumanReview: true, reason: "Success rate below 30%" };
  }
  return { requiresHumanReview: false };
}

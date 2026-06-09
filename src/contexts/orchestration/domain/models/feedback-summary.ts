export interface FeedbackSummary {
  category: string;
  module: string;
  riskLevel: string;
  totalPlans: number;
  successRate: number;
  approvalRate: number;
  averageConfidence: number;
  confidenceAccuracy: number;
  recentTrend: "improving" | "declining" | "stable";
  guardrails: GuardrailConfig;
  commonFailures: string[];
  successPatterns: string[];
}

export interface GuardrailConfig {
  confidenceCeiling?: number;
  confidenceFloor?: number;
  requiresHumanReview: boolean;
  reason?: string;
}

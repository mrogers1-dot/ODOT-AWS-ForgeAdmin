/**
 * FeedbackEntry — captures signals from approval/execution outcomes
 * to feed back into confidence scoring and KB improvements.
 */

export interface FeedbackEntry {
  id: string;
  workItemId: string;
  planId: string;
  timestamp: string;
  category: string;
  riskLevel: string;
  module: string;
  signal: "positive" | "negative";
  outcomeType: "approved" | "rejected" | "succeeded" | "failed" | "verified";
  confidenceAtDecision: number;
  planStepCount?: number;
  kbItemsUsed?: string[];
  rejectionReason?: string;
  failureDetail?: string;
}

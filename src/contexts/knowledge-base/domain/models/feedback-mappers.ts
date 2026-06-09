/**
 * Feedback Mappers — transform event payloads into FeedbackEntry records.
 */

import { randomUUID } from "node:crypto";
import type { FeedbackEntry } from "./feedback-entry";

export interface ApprovalDecisionEvent {
  workItemId: string;
  planId: string;
  category: string;
  riskLevel: string;
  decision: "approved" | "rejected";
  confidenceAtDecision: number;
  planStepCount?: number;
  kbItemsUsed?: string[];
  rejectionReason?: string;
  timestamp: string;
}

export interface ExecutionCompletedEvent {
  workItemId: string;
  planId: string;
  category: string;
  riskLevel: string;
  confidenceAtDecision: number;
  planStepCount?: number;
  kbItemsUsed?: string[];
  timestamp: string;
}

export interface ExecutionFailedEvent {
  workItemId: string;
  planId: string;
  category: string;
  riskLevel: string;
  confidenceAtDecision: number;
  planStepCount?: number;
  kbItemsUsed?: string[];
  failureDetail: string;
  timestamp: string;
}

export function mapApprovalDecision(event: ApprovalDecisionEvent): FeedbackEntry {
  return {
    id: randomUUID(),
    workItemId: event.workItemId,
    planId: event.planId,
    timestamp: event.timestamp,
    category: event.category,
    riskLevel: event.riskLevel,
    module: "approval",
    signal: event.decision === "approved" ? "positive" : "negative",
    outcomeType: event.decision,
    confidenceAtDecision: event.confidenceAtDecision,
    planStepCount: event.planStepCount,
    kbItemsUsed: event.kbItemsUsed,
    rejectionReason: event.rejectionReason,
  };
}

export function mapExecutionCompleted(event: ExecutionCompletedEvent): FeedbackEntry {
  return {
    id: randomUUID(),
    workItemId: event.workItemId,
    planId: event.planId,
    timestamp: event.timestamp,
    category: event.category,
    riskLevel: event.riskLevel,
    module: "execution",
    signal: "positive",
    outcomeType: "succeeded",
    confidenceAtDecision: event.confidenceAtDecision,
    planStepCount: event.planStepCount,
    kbItemsUsed: event.kbItemsUsed,
  };
}

export function mapExecutionFailed(event: ExecutionFailedEvent): FeedbackEntry {
  return {
    id: randomUUID(),
    workItemId: event.workItemId,
    planId: event.planId,
    timestamp: event.timestamp,
    category: event.category,
    riskLevel: event.riskLevel,
    module: "execution",
    signal: "negative",
    outcomeType: "failed",
    confidenceAtDecision: event.confidenceAtDecision,
    planStepCount: event.planStepCount,
    kbItemsUsed: event.kbItemsUsed,
    failureDetail: event.failureDetail,
  };
}

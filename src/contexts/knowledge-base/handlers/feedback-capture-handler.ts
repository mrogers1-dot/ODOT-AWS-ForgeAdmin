import { randomUUID } from "node:crypto";
import type { FeedbackEntry } from "../domain/models/feedback-entry";

export interface FeedbackCaptureEvent {
  workItemId: string;
  planId: string;
  outcomeType: "approved" | "rejected" | "succeeded" | "failed" | "verified";
  category: string;
  confidenceAtDecision: number;
  rejectionReason?: string;
  failureDetail?: string;
}

export type StoreFn = (entry: FeedbackEntry) => Promise<void>;

export interface CaptureResult {
  success: boolean;
  feedbackId?: string;
  error?: string;
}

export async function captureFeedback(event: FeedbackCaptureEvent, store: StoreFn): Promise<CaptureResult> {
  try {
    const signal = (event.outcomeType === "approved" || event.outcomeType === "succeeded" || event.outcomeType === "verified")
      ? "positive" : "negative";

    const entry: FeedbackEntry = {
      id: randomUUID(),
      workItemId: event.workItemId,
      planId: event.planId,
      timestamp: new Date().toISOString(),
      category: event.category,
      riskLevel: "medium",
      module: "default",
      signal,
      outcomeType: event.outcomeType,
      confidenceAtDecision: event.confidenceAtDecision,
      rejectionReason: event.rejectionReason,
      failureDetail: event.failureDetail,
    };

    await store(entry);
    return { success: true, feedbackId: entry.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

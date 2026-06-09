/**
 * Planning Agent — deterministic plan generation from KB research results.
 *
 * Calculates confidence from average relevance scores and generates
 * execution steps derived from knowledge base items.
 */

import type { KnowledgeItem } from "../models/knowledge-item";
import type { ResearchResult } from "./research";
import { createConfidenceScore, type ConfidenceScore } from "../models/confidence-score";
import { createExecutionPlan, type ExecutionPlan, type PlanStep } from "../models/execution-plan";

export interface PlanningInput {
  workItemId: string;
  category: string;
  researchResult: ResearchResult;
  serviceNowTicketId?: string;
}

export interface PlanningResult {
  plan: ExecutionPlan | null;
  confidence: ConfidenceScore;
  escalated: boolean;
  escalationReason?: string;
  justification: string;
}

const ESCALATION_THRESHOLD = 30;
const KB_UNAVAILABLE_CAP = 50;

function calculateRawConfidence(items: KnowledgeItem[]): number {
  if (items.length === 0) return 0;
  const avg = items.reduce((sum, item) => sum + item.relevanceScore, 0) / items.length;
  return Math.round(avg * 100);
}

function generateSteps(items: KnowledgeItem[]): PlanStep[] {
  return items.map((item, index) => ({
    stepIndex: index,
    description: `Apply resolution from "${item.title}"`,
    expectedOutcome: `Resolved using KB item ${item.itemId}`,
    rollback: `Revert changes from step ${index} (${item.itemId})`,
  }));
}

export function plan(input: PlanningInput): PlanningResult {
  const { researchResult, workItemId } = input;
  const { items, kbUnavailable } = researchResult;

  // Calculate confidence
  let rawConfidence = calculateRawConfidence(items);

  // Cap at 50 when KB was unavailable
  if (kbUnavailable) {
    rawConfidence = Math.min(rawConfidence, KB_UNAVAILABLE_CAP);
  }

  const confidence = createConfidenceScore(rawConfidence, [
    { factor: "relevance_average", weight: rawConfidence },
    { factor: "item_count", weight: Math.min(items.length * 10, 100) },
  ]);

  // Build justification referencing KB item IDs
  const referencedIds = items.map((item) => item.itemId).join(", ");
  const justification = items.length > 0
    ? `Plan derived from KB items: ${referencedIds}. Average relevance: ${(rawConfidence / 100).toFixed(2)}.`
    : "No KB items available to generate plan.";

  // Escalate if confidence is too low
  if (confidence.value < ESCALATION_THRESHOLD) {
    return {
      plan: null,
      confidence,
      escalated: true,
      escalationReason: `Confidence ${confidence.value} is below threshold ${ESCALATION_THRESHOLD}. Escalating to human operator.`,
      justification,
    };
  }

  // Generate plan steps from KB items
  const steps = generateSteps(items);
  const executionPlan = createExecutionPlan({
    workItemId,
    steps,
    confidenceScore: confidence.value,
    justification,
  });

  return {
    plan: executionPlan,
    confidence,
    escalated: false,
    justification,
  };
}

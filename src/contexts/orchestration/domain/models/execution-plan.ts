/**
 * ExecutionPlan entity — ordered steps with confidence and justification.
 */

import { randomUUID } from "node:crypto";

export interface PlanStep {
  readonly stepIndex: number;
  readonly description: string;
  readonly expectedOutcome: string;
  readonly rollback: string;
}

export interface ExecutionPlan {
  readonly planId: string;
  readonly workItemId: string;
  readonly steps: readonly PlanStep[];
  readonly confidenceScore: number;
  readonly justification: string;
  readonly createdAt: string;
}

export interface CreatePlanInput {
  workItemId: string;
  steps: PlanStep[];
  confidenceScore: number;
  justification: string;
}

export function createExecutionPlan(input: CreatePlanInput): ExecutionPlan {
  if (input.steps.length === 0) {
    throw new Error("ExecutionPlan must have at least 1 step");
  }
  if (input.steps.length > 20) {
    throw new Error("ExecutionPlan cannot exceed 20 steps");
  }

  return Object.freeze({
    planId: randomUUID(),
    workItemId: input.workItemId,
    steps: Object.freeze([...input.steps]),
    confidenceScore: input.confidenceScore,
    justification: input.justification,
    createdAt: new Date().toISOString(),
  });
}

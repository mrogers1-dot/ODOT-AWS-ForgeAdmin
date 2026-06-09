/**
 * Shadow Mode — intercepts module execution and logs proposed actions without executing.
 */

export interface ShadowInput {
  workItemId: string;
  moduleId: string;
  proposedPlan: {
    steps: string[];
    confidence: number;
  };
}

export interface ShadowRecord {
  workItemId: string;
  moduleId: string;
  proposedActions: string[];
  confidenceScore: number;
  recordedAt: string;
}

export interface ShadowResult {
  executed: false;
  record: ShadowRecord;
}

export function processShadow(input: ShadowInput): ShadowResult {
  const record: ShadowRecord = {
    workItemId: input.workItemId,
    moduleId: input.moduleId,
    proposedActions: [...input.proposedPlan.steps],
    confidenceScore: input.proposedPlan.confidence,
    recordedAt: new Date().toISOString(),
  };

  return { executed: false, record };
}

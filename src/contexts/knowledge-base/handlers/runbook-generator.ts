/**
 * Runbook Generator — produces structured runbooks from resolution steps.
 */

import { randomUUID } from "node:crypto";

export interface RunbookInput {
  workItemId: string;
  title: string;
  resolutionSteps: string[];
  category: string;
}

export interface Runbook {
  runbookId: string;
  title: string;
  applicableTypes: string[];
  prerequisites: string[];
  procedure: string[];
  expectedOutcomes: string[];
  rollbackSteps: string[];
  flaggedForReview: boolean;
}

export function generateRunbook(input: RunbookInput): Runbook {
  const hasSteps = input.resolutionSteps.length > 0;

  return {
    runbookId: randomUUID(),
    title: input.title || "[Untitled Runbook]",
    applicableTypes: [input.category],
    prerequisites: hasSteps
      ? ["Verify system access", "Confirm change window"]
      : ["[Manual review required]"],
    procedure: hasSteps
      ? input.resolutionSteps
      : ["[No steps recorded — manual review required]"],
    expectedOutcomes: hasSteps
      ? ["Issue resolved per documented steps"]
      : ["[Pending review]"],
    rollbackSteps: hasSteps
      ? ["Revert changes in reverse order"]
      : ["[Pending review]"],
    flaggedForReview: !hasSteps,
  };
}

/**
 * WorkItem entity in the Orchestration context — includes classification fields.
 */

import type { WorkItemCategory, RiskLevel, UrgencyLevel } from "@forgeadmin/shared";

export interface OrchestrationWorkItem {
  readonly workItemId: string;
  readonly sourceSystem: "servicenow" | "email" | "fortisiem";
  readonly originalId: string;
  readonly title: string;
  readonly description: string;
  readonly priority?: string;
  readonly urgency?: string;
  readonly affectedSystem?: string;
  readonly reporter?: string;
  readonly sourceTimestamp: string;
  readonly metadata?: Record<string, unknown>;
  // Classification (set by Triage agent)
  readonly category?: WorkItemCategory;
  readonly riskLevel?: RiskLevel;
  readonly urgencyLevel?: UrgencyLevel;
  readonly classificationJustification?: string;
}

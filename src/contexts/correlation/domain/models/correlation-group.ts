/**
 * CorrelationGroup — formed when a session meets minItems threshold.
 */

export interface CorrelationGroup {
  readonly groupId: string;
  readonly ruleId: string;
  readonly action: "merge" | "enrich";
  readonly memberItems: readonly string[];
  readonly parentWorkItem?: string;
  readonly suggestedRootCause?: string;
  readonly formedAt: string;
}

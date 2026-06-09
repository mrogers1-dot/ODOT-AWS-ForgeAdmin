/**
 * CorrelationRule — defines how work items are grouped.
 */

export interface MatchAttribute {
  readonly field: string;
  readonly matchType: "exact" | "fuzzy";
  readonly threshold?: number; // 0-1, for fuzzy only
}

export interface CorrelationRule {
  readonly id: string;
  readonly name: string;
  readonly type: "temporal" | "infrastructure" | "causal" | "repeat";
  readonly matchAttributes: readonly MatchAttribute[];
  readonly window: {
    readonly gapSeconds: number;
    readonly maxDurationSeconds?: number;
  };
  readonly minItems: number;
  readonly action: "merge" | "enrich";
  readonly priority: number;
  readonly enabled: boolean;
  readonly lookbackDays?: number;
}

export type FailureAction = "skip" | "passthrough";

/**
 * ConfidenceScore value object — 0-100 integer with factor breakdown.
 */

export interface ConfidenceFactor {
  readonly factor: string;
  readonly weight: number;
}

export interface ConfidenceScore {
  readonly value: number;
  readonly factors: readonly ConfidenceFactor[];
}

export function createConfidenceScore(
  value: number,
  factors: ConfidenceFactor[],
): ConfidenceScore {
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) {
    throw new RangeError(`ConfidenceScore must be 0-100, got ${rounded}`);
  }
  return Object.freeze({ value: rounded, factors: Object.freeze([...factors]) });
}

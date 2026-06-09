/**
 * Confidence Calibration computation.
 *
 * Brier score = mean((predicted - actual)^2) where predicted is confidence/100
 * and actual is 1 (success) or 0 (failure).
 */

export interface CalibrationPoint {
  band: string;
  predictedMean: number;
  actualSuccessRate: number;
  deviation: number;
  sampleSize: number;
}

export interface CalibrationData {
  points: CalibrationPoint[];
  brierScore: number;
}

export interface ConfidenceOutcome {
  confidence: number; // 0-100
  success: boolean;
}

const BANDS = [
  { label: "0-20", min: 0, max: 20 },
  { label: "20-40", min: 20, max: 40 },
  { label: "40-60", min: 40, max: 60 },
  { label: "60-80", min: 60, max: 80 },
  { label: "80-100", min: 80, max: 100 },
];

export function computeCalibration(outcomes: ConfidenceOutcome[]): CalibrationData {
  // Brier score
  let brierSum = 0;
  for (const o of outcomes) {
    const predicted = o.confidence / 100;
    const actual = o.success ? 1 : 0;
    brierSum += (predicted - actual) ** 2;
  }
  const brierScore = outcomes.length > 0 ? brierSum / outcomes.length : 0;

  // Per-band calibration points
  const points: CalibrationPoint[] = BANDS.map((band) => {
    const bandOutcomes = outcomes.filter(
      (o) => o.confidence >= band.min && o.confidence < (band.max === 100 ? 101 : band.max),
    );

    const sampleSize = bandOutcomes.length;
    const predictedMean = sampleSize > 0
      ? bandOutcomes.reduce((s, o) => s + o.confidence, 0) / sampleSize / 100
      : (band.min + band.max) / 200;
    const actualSuccessRate = sampleSize > 0
      ? bandOutcomes.filter((o) => o.success).length / sampleSize
      : 0;

    return {
      band: band.label,
      predictedMean: Math.round(predictedMean * 1000) / 1000,
      actualSuccessRate: Math.round(actualSuccessRate * 1000) / 1000,
      deviation: Math.round((predictedMean - actualSuccessRate) * 1000) / 1000,
      sampleSize,
    };
  });

  return { points, brierScore: Math.round(brierScore * 10000) / 10000 };
}

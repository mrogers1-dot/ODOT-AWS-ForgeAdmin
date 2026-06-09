/**
 * Verification Agent — compares actual outcomes against expected and produces a verdict.
 */

export interface StepOutcome {
  stepIndex: number;
  expectedOutcome: string;
  actualOutcome: string;
}

export interface VerificationResult {
  overallResult: "pass" | "fail" | "partial";
  stepResults: Array<{ stepIndex: number; result: "pass" | "fail"; detail: string }>;
  flaggedForReview: boolean;
  resolutionSummary?: string;
}

export function verify(outcomes: StepOutcome[]): VerificationResult {
  const stepResults = outcomes.map((outcome) => {
    const passed = outcome.actualOutcome === outcome.expectedOutcome;
    return {
      stepIndex: outcome.stepIndex,
      result: (passed ? "pass" : "fail") as "pass" | "fail",
      detail: passed
        ? `Step ${outcome.stepIndex} matched expected outcome.`
        : `Step ${outcome.stepIndex} mismatch: expected "${outcome.expectedOutcome}", got "${outcome.actualOutcome}".`,
    };
  });

  const allPassed = stepResults.every((s) => s.result === "pass");

  if (allPassed) {
    const summary = stepResults
      .map((s) => `Step ${s.stepIndex}: passed`)
      .join("; ");

    return {
      overallResult: "pass",
      stepResults,
      flaggedForReview: false,
      resolutionSummary: `All ${stepResults.length} steps completed successfully. ${summary}.`,
    };
  }

  return {
    overallResult: "fail",
    stepResults,
    flaggedForReview: true,
  };
}

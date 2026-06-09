import { describe, it, expect } from "vitest";
import { createConfidenceScore } from "./confidence-score";

describe("ConfidenceScore", () => {
  it("creates a valid score within 0-100 range", () => {
    const score = createConfidenceScore(75, [
      { factor: "kb_relevance", weight: 0.4 },
      { factor: "historical_success", weight: 0.35 },
    ]);
    expect(score.value).toBe(75);
    expect(score.factors).toHaveLength(2);
  });

  it("rejects score below 0", () => {
    expect(() => createConfidenceScore(-1, [])).toThrow();
  });

  it("rejects score above 100", () => {
    expect(() => createConfidenceScore(101, [])).toThrow();
  });

  it("clamps to integer", () => {
    const score = createConfidenceScore(72.7, []);
    expect(score.value).toBe(73);
  });
});

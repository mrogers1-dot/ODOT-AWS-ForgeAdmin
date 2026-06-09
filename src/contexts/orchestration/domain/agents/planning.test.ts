import { describe, it, expect } from "vitest";
import { plan } from "./planning";
import type { PlanningInput } from "./planning";
import type { ResearchResult } from "./research";
import type { KnowledgeItem } from "../models/knowledge-item";

function makeItem(id: string, score: number): KnowledgeItem {
  return {
    itemId: id,
    title: `KB Article ${id}`,
    content: `Content for ${id}`,
    category: "health_remediation",
    relevanceScore: score,
  };
}

function makeInput(overrides?: Partial<PlanningInput>): PlanningInput {
  const researchResult: ResearchResult = {
    items: [makeItem("kb-1", 0.8), makeItem("kb-2", 0.6)],
    knowledgeGap: false,
    kbUnavailable: false,
  };
  return {
    workItemId: "wi-001",
    category: "health_remediation",
    researchResult,
    ...overrides,
  };
}

describe("Planning Agent", () => {
  it("generates plan with ordered steps ≤20, each with description/expectedOutcome/rollback", () => {
    const result = plan(makeInput());

    expect(result.plan).not.toBeNull();
    expect(result.plan!.steps.length).toBeGreaterThan(0);
    expect(result.plan!.steps.length).toBeLessThanOrEqual(20);
    for (const step of result.plan!.steps) {
      expect(step.description).toBeDefined();
      expect(step.expectedOutcome).toBeDefined();
      expect(step.rollback).toBeDefined();
      expect(step.stepIndex).toBeGreaterThanOrEqual(0);
    }
    // Steps are ordered
    for (let i = 1; i < result.plan!.steps.length; i++) {
      expect(result.plan!.steps[i].stepIndex).toBeGreaterThan(result.plan!.steps[i - 1].stepIndex);
    }
  });

  it("calculates confidence 0-100 with factor breakdown", () => {
    const result = plan(makeInput());

    expect(result.confidence.value).toBeGreaterThanOrEqual(0);
    expect(result.confidence.value).toBeLessThanOrEqual(100);
    expect(result.confidence.factors.length).toBeGreaterThan(0);
    for (const factor of result.confidence.factors) {
      expect(factor.factor).toBeDefined();
      expect(factor.weight).toBeGreaterThanOrEqual(0);
    }
  });

  it("confidence < 30 triggers escalation result", () => {
    const researchResult: ResearchResult = {
      items: [makeItem("kb-1", 0.3)],
      knowledgeGap: false,
      kbUnavailable: false,
    };
    const result = plan(makeInput({ researchResult }));

    // avg relevance 0.3 * 100 = 30, but since we need < 30, use lower
    const lowResearch: ResearchResult = {
      items: [makeItem("kb-1", 0.2)],
      knowledgeGap: false,
      kbUnavailable: false,
    };
    const escalatedResult = plan(makeInput({ researchResult: lowResearch }));

    expect(escalatedResult.escalated).toBe(true);
    expect(escalatedResult.escalationReason).toBeDefined();
    expect(escalatedResult.plan).toBeNull();
  });

  it("caps confidence at 50 when kbUnavailable flag is present", () => {
    const researchResult: ResearchResult = {
      items: [makeItem("kb-1", 0.9), makeItem("kb-2", 0.85)],
      knowledgeGap: false,
      kbUnavailable: true,
    };
    const result = plan(makeInput({ researchResult }));

    expect(result.confidence.value).toBeLessThanOrEqual(50);
  });

  it("justification references at least one KB item ID", () => {
    const result = plan(makeInput());

    expect(result.justification).toContain("kb-1");
  });
});

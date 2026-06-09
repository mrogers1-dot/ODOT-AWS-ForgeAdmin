import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { plan } from "./planning";
import type { PlanningInput } from "./planning";
import type { ResearchResult } from "./research";
import type { KnowledgeItem } from "../models/knowledge-item";

function makeItem(id: string, score: number): KnowledgeItem {
  return {
    itemId: id,
    title: `KB-${id}`,
    content: `Content for ${id}`,
    category: "health_remediation",
    relevanceScore: score,
  };
}

const arbRelevanceScore = fc.double({ min: 0.3, max: 1.0, noNaN: true });

describe("Planning Agent — Property Tests", () => {
  it("PROPERTY: confidence monotonicity — higher avg relevance produces higher or equal confidence", () => {
    fc.assert(
      fc.property(
        arbRelevanceScore,
        arbRelevanceScore,
        (score1, score2) => {
          const low = Math.min(score1, score2);
          const high = Math.max(score1, score2);

          const lowInput: PlanningInput = {
            workItemId: "wi-mono",
            category: "health_remediation",
            researchResult: { items: [makeItem("a", low)], knowledgeGap: false, kbUnavailable: false },
          };
          const highInput: PlanningInput = {
            workItemId: "wi-mono",
            category: "health_remediation",
            researchResult: { items: [makeItem("a", high)], knowledgeGap: false, kbUnavailable: false },
          };

          const lowResult = plan(lowInput);
          const highResult = plan(highInput);

          expect(highResult.confidence.value).toBeGreaterThanOrEqual(lowResult.confidence.value);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("PROPERTY: every generated plan has ≤20 steps", () => {
    const arbItems = fc.array(
      fc.double({ min: 0.3, max: 1.0, noNaN: true }).map((score) => makeItem(`kb-${Math.random().toString(36).slice(2, 6)}`, score)),
      { minLength: 1, maxLength: 25 },
    );

    fc.assert(
      fc.property(arbItems, (items) => {
        const input: PlanningInput = {
          workItemId: "wi-bounded",
          category: "health_remediation",
          researchResult: { items, knowledgeGap: false, kbUnavailable: false },
        };

        const result = plan(input);

        if (result.plan) {
          expect(result.plan.steps.length).toBeLessThanOrEqual(20);
          expect(result.plan.steps.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("PROPERTY: every step has a rollback defined", () => {
    const items = [makeItem("kb-1", 0.8), makeItem("kb-2", 0.7), makeItem("kb-3", 0.6)];
    const input: PlanningInput = {
      workItemId: "wi-rollback",
      category: "health_remediation",
      researchResult: { items, knowledgeGap: false, kbUnavailable: false },
    };

    const result = plan(input);

    if (result.plan) {
      for (const step of result.plan.steps) {
        expect(step.rollback).toBeDefined();
        expect(step.rollback.length).toBeGreaterThan(0);
      }
    }
  });
});

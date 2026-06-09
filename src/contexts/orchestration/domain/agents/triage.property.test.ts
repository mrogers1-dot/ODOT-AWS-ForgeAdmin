import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { triage } from "./triage";
import type { OrchestrationWorkItem } from "../models/work-item";

const VALID_CATEGORIES = ["account_service_request", "health_remediation", "security_alert", "knowledge_capture"];
const VALID_RISK_LEVELS = ["low", "medium", "high"];
const VALID_URGENCY_LEVELS = ["critical", "high", "normal", "low"];

const arbWorkItem = fc.record({
  workItemId: fc.uuid(),
  sourceSystem: fc.constantFrom("servicenow" as const, "email" as const, "fortisiem" as const),
  originalId: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 0, maxLength: 200 }),
  description: fc.string({ minLength: 0, maxLength: 500 }),
  sourceTimestamp: fc.constant("2026-06-09T08:00:00Z"),
  priority: fc.option(fc.constantFrom("1", "2", "3", "4"), { nil: undefined }),
  urgency: fc.option(fc.constantFrom("1", "2", "3", "4"), { nil: undefined }),
  affectedSystem: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  reporter: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

describe("Triage Agent — Property Tests", () => {
  it("PROPERTY: for any valid work item, produces exactly one category, one risk level, one urgency level", () => {
    fc.assert(
      fc.property(arbWorkItem, (item: OrchestrationWorkItem) => {
        const result = triage(item);

        // Exactly one category
        expect(VALID_CATEGORIES).toContain(result.category);

        // Exactly one risk level
        expect(VALID_RISK_LEVELS).toContain(result.riskLevel);

        // Exactly one urgency level
        expect(VALID_URGENCY_LEVELS).toContain(result.urgencyLevel);

        // Justification is always non-empty
        expect(result.justification.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it("PROPERTY: result never has undefined or null fields", () => {
    fc.assert(
      fc.property(arbWorkItem, (item: OrchestrationWorkItem) => {
        const result = triage(item);

        expect(result.category).not.toBeNull();
        expect(result.category).not.toBeUndefined();
        expect(result.riskLevel).not.toBeNull();
        expect(result.riskLevel).not.toBeUndefined();
        expect(result.urgencyLevel).not.toBeNull();
        expect(result.urgencyLevel).not.toBeUndefined();
        expect(result.justification).not.toBeNull();
        expect(result.justification).not.toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });
});

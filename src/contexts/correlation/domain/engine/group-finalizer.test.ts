import { describe, it, expect } from "vitest";
import { finalizeSession } from "./group-finalizer";
import type { CorrelationSession } from "../models/correlation-session";
import type { CorrelationRule } from "../models/correlation-rule";

function makeRule(overrides?: Partial<CorrelationRule>): CorrelationRule {
  return {
    id: "rule-1",
    name: "Same Rack Alerts",
    type: "infrastructure",
    matchAttributes: [{ field: "affectedSystem", matchType: "exact" }],
    window: { gapSeconds: 300 },
    minItems: 3,
    action: "merge",
    priority: 1,
    enabled: true,
    ...overrides,
  };
}

function makeSession(items: string[]): CorrelationSession {
  return {
    sessionId: "sess-001",
    ruleId: "rule-1",
    matchKey: "web-01",
    status: "open",
    items,
    openedAt: "2026-06-09T08:00:00Z",
    lastActivityAt: "2026-06-09T08:05:00Z",
  };
}

describe("Group Finalizer", () => {
  it("session items >= minItems forms group with groupId", () => {
    const session = makeSession(["wi-001", "wi-002", "wi-003"]);
    const rule = makeRule({ minItems: 3 });

    const result = finalizeSession(session, rule);

    expect(result.formed).toBe(true);
    expect(result.group).toBeDefined();
    expect(result.group!.groupId).toBeDefined();
    expect(result.group!.memberItems).toHaveLength(3);
    expect(result.group!.ruleId).toBe("rule-1");
  });

  it("session items < minItems returns dissolved (no group)", () => {
    const session = makeSession(["wi-001", "wi-002"]);
    const rule = makeRule({ minItems: 3 });

    const result = finalizeSession(session, rule);

    expect(result.formed).toBe(false);
    expect(result.group).toBeUndefined();
    expect(result.dissolvedItems).toEqual(["wi-001", "wi-002"]);
  });

  it("merge action sets parentWorkItem", () => {
    const session = makeSession(["wi-001", "wi-002", "wi-003"]);
    const rule = makeRule({ action: "merge", minItems: 3 });

    const result = finalizeSession(session, rule);

    expect(result.formed).toBe(true);
    expect(result.group!.parentWorkItem).toBeDefined();
    expect(typeof result.group!.parentWorkItem).toBe("string");
  });

  it("enrich action does NOT set parentWorkItem", () => {
    const session = makeSession(["wi-001", "wi-002", "wi-003"]);
    const rule = makeRule({ action: "enrich", minItems: 3 });

    const result = finalizeSession(session, rule);

    expect(result.formed).toBe(true);
    expect(result.group!.parentWorkItem).toBeUndefined();
  });
});

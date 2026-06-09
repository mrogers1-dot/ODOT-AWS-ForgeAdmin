import { describe, it, expect, vi } from "vitest";
import { manageSession } from "./session-manager";
import type { ISessionStore } from "../ports/ISessionStore";
import type { CorrelationRule } from "../models/correlation-rule";
import type { CorrelationSession } from "../models/correlation-session";

function makeRule(): CorrelationRule {
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
  };
}

function makeStore(existingSession: CorrelationSession | null = null): ISessionStore {
  return {
    getByRuleAndMatchKey: vi.fn().mockResolvedValue(existingSession),
    save: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getExpiredSessions: vi.fn().mockResolvedValue([]),
  };
}

describe("Session Manager", () => {
  it("no open session → creates new session", async () => {
    const store = makeStore(null);
    const rule = makeRule();

    const result = await manageSession(store, rule, "web-01", "wi-001");

    expect(result.isNew).toBe(true);
    expect(result.session.ruleId).toBe("rule-1");
    expect(result.session.matchKey).toBe("web-01");
    expect(result.session.items).toContain("wi-001");
    expect(store.save).toHaveBeenCalledOnce();
  });

  it("open session exists → adds item to session", async () => {
    const existingSession: CorrelationSession = {
      sessionId: "sess-001",
      ruleId: "rule-1",
      matchKey: "web-01",
      status: "open",
      items: ["wi-001"],
      openedAt: "2026-06-09T08:00:00Z",
      lastActivityAt: "2026-06-09T08:00:00Z",
    };
    const store = makeStore(existingSession);
    const rule = makeRule();

    const result = await manageSession(store, rule, "web-01", "wi-002");

    expect(result.isNew).toBe(false);
    expect(result.session.items).toContain("wi-001");
    expect(result.session.items).toContain("wi-002");
    expect(store.save).toHaveBeenCalledOnce();
  });

  it("generates matchKey from rule attributes", async () => {
    const store = makeStore(null);
    const rule = makeRule();
    const matchKey = "web-01|rack-A";

    const result = await manageSession(store, rule, matchKey, "wi-001");

    expect(result.session.matchKey).toBe("web-01|rack-A");
  });
});

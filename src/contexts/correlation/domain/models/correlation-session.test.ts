import { describe, it, expect } from "vitest";
import { createSession, addItemToSession } from "./correlation-session";

describe("CorrelationSession", () => {
  it("creates a new open session with one item", () => {
    const session = createSession("rule-1", "match-key-abc", "item-001");
    expect(session.status).toBe("open");
    expect(session.ruleId).toBe("rule-1");
    expect(session.matchKey).toBe("match-key-abc");
    expect(session.items).toEqual(["item-001"]);
    expect(session.sessionId).toBeDefined();
  });

  it("adds items to an existing session", () => {
    const session = createSession("rule-1", "key-1", "item-001");
    const updated = addItemToSession(session, "item-002");
    expect(updated.items).toEqual(["item-001", "item-002"]);
    expect(updated.items).toHaveLength(2);
  });

  it("does not add duplicate items", () => {
    const session = createSession("rule-1", "key-1", "item-001");
    const updated = addItemToSession(session, "item-001");
    expect(updated.items).toHaveLength(1);
  });
});

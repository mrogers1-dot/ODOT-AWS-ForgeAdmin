import { describe, it, expect, vi } from "vitest";
import { handleAuditEvent, type AuditEvent, type AuditEntry, type WriteFn } from "./audit-handler";

describe("Audit Trail Service", () => {
  const baseEvent: AuditEvent = {
    actor: "user@dot.ohio.gov",
    action: "work-item.created",
    context: "orchestration",
    resourceId: "wi-123",
  };

  it("event produces audit entry with correct fields", async () => {
    const write: WriteFn = vi.fn().mockResolvedValue(undefined);
    const entry = await handleAuditEvent(baseEvent, write);

    expect(entry.entryId).toBeDefined();
    expect(entry.actor).toBe(baseEvent.actor);
    expect(entry.action).toBe(baseEvent.action);
    expect(entry.context).toBe(baseEvent.context);
    expect(entry.recordedAt).toBeDefined();
    // Validate ISO timestamp format
    expect(new Date(entry.recordedAt).toISOString()).toBe(entry.recordedAt);
  });

  it("entries include ServiceNow ticket links when provided", async () => {
    const write: WriteFn = vi.fn().mockResolvedValue(undefined);
    const event: AuditEvent = { ...baseEvent, serviceNowTicketId: "INC0012345" };
    const entry = await handleAuditEvent(event, write);

    expect(entry.serviceNowTicketId).toBe("INC0012345");
  });

  it("entries are append-only (returns frozen immutable entry)", async () => {
    const write: WriteFn = vi.fn().mockResolvedValue(undefined);
    const entry = await handleAuditEvent(baseEvent, write);

    // Object.freeze makes mutations throw in strict mode / silently fail
    expect(Object.isFrozen(entry)).toBe(true);
    expect(() => {
      (entry as Record<string, unknown>).actor = "hacker";
    }).toThrow();
  });
});

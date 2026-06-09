import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { handleAuditEvent, type AuditEvent } from "./audit-handler";

const arbAuditEvent: fc.Arbitrary<AuditEvent> = fc.record({
  actor: fc.string({ minLength: 1, maxLength: 30 }),
  action: fc.string({ minLength: 1, maxLength: 30 }),
  context: fc.constantFrom("ingestion", "orchestration", "execution", "platform"),
  resourceId: fc.option(fc.uuid(), { nil: undefined }),
  serviceNowTicketId: fc.option(fc.string({ minLength: 5, maxLength: 15 }), { nil: undefined }),
});

describe("Audit Trail — Property Tests", () => {
  it("PROPERTY: every event produces exactly one audit entry with unique ID", async () => {
    await fc.assert(
      fc.asyncProperty(arbAuditEvent, async (event) => {
        const ids = new Set<string>();
        const write = async (entry: any) => { ids.add(entry.entryId); };

        const entry = await handleAuditEvent(event, write);

        expect(entry.entryId).toBeDefined();
        expect(entry.actor).toBe(event.actor);
        expect(entry.action).toBe(event.action);
        expect(entry.context).toBe(event.context);
        expect(entry.recordedAt).toBeDefined();
        expect(ids.size).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});

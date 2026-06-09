import { describe, it, expect } from "vitest";
import { createWorkItemCreatedEvent } from "./publisher";
import type { WorkItem } from "./models";

const sampleWorkItem: WorkItem = {
  workItemId: "wi-001",
  sourceSystem: "servicenow",
  originalId: "INC001",
  title: "Disk full on web-01",
  description: "Root partition at 98%",
  priority: "2",
  urgency: "2",
  affectedSystem: "web-01.dot.ohio.gov",
  reporter: "monitoring",
  sourceTimestamp: "2026-06-09T08:00:00Z",
};

describe("Ingestion Publisher", () => {
  it("valid work item produces conformant work-item.created event envelope", () => {
    const event = createWorkItemCreatedEvent(sampleWorkItem);

    expect(event.version).toBe("1.0.0");
    expect(event.source).toBe("forgeadmin.ingestion");
    expect(event.detailType).toBe("work-item.created");
    expect(event.timestamp).toBeDefined();
    expect(event.correlationId).toBeDefined();
    expect(event.payload).toBeDefined();
  });

  it("correlationId is set on event", () => {
    const customId = "corr-12345";
    const event = createWorkItemCreatedEvent(sampleWorkItem, customId);

    expect(event.correlationId).toBe(customId);
  });

  it("event includes all required payload fields", () => {
    const event = createWorkItemCreatedEvent(sampleWorkItem);
    const payload = event.payload as WorkItem;

    expect(payload.workItemId).toBe("wi-001");
    expect(payload.sourceSystem).toBe("servicenow");
    expect(payload.originalId).toBe("INC001");
    expect(payload.title).toBe("Disk full on web-01");
    expect(payload.description).toBe("Root partition at 98%");
    expect(payload.sourceTimestamp).toBe("2026-06-09T08:00:00Z");
  });
});

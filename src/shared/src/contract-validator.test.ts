import { describe, it, expect } from "vitest";
import { validateEvent, ValidationResult } from "./contract-validator";

describe("contract-validator", () => {
  it("validates a conformant work-item.created event", () => {
    const event = {
      version: "1.0.0",
      correlationId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2026-06-09T10:00:00.000Z",
      source: "forgeadmin.ingestion",
      detailType: "work-item.created",
      payload: {
        workItemId: "660e8400-e29b-41d4-a716-446655440001",
        sourceSystem: "servicenow",
        originalId: "INC0001234",
        title: "Server disk full",
        description: "Disk usage at 95% on web-server-01",
        sourceTimestamp: "2026-06-09T09:55:00.000Z",
      },
    };

    const result = validateEvent("ingestion/work-item.created", event);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an event missing required fields", () => {
    const event = {
      version: "1.0.0",
      // missing correlationId
      timestamp: "2026-06-09T10:00:00.000Z",
      source: "forgeadmin.ingestion",
      detailType: "work-item.created",
      payload: {
        workItemId: "660e8400-e29b-41d4-a716-446655440001",
        sourceSystem: "servicenow",
        originalId: "INC0001234",
        title: "Server disk full",
        description: "Disk usage at 95%",
        sourceTimestamp: "2026-06-09T09:55:00.000Z",
      },
    };

    const result = validateEvent("ingestion/work-item.created", event);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects an event with invalid payload", () => {
    const event = {
      version: "1.0.0",
      correlationId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2026-06-09T10:00:00.000Z",
      source: "forgeadmin.ingestion",
      detailType: "work-item.created",
      payload: {
        workItemId: "660e8400-e29b-41d4-a716-446655440001",
        sourceSystem: "invalid_source", // not in enum
        originalId: "INC0001234",
        title: "Test",
        description: "Test",
        sourceTimestamp: "2026-06-09T09:55:00.000Z",
      },
    };

    const result = validateEvent("ingestion/work-item.created", event);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("provides error path for nested validation failures", () => {
    const event = {
      version: "1.0.0",
      correlationId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2026-06-09T10:00:00.000Z",
      source: "forgeadmin.ingestion",
      detailType: "work-item.created",
      payload: {
        workItemId: "660e8400-e29b-41d4-a716-446655440001",
        sourceSystem: "servicenow",
        originalId: "", // minLength violation
        title: "Test",
        description: "Test",
        sourceTimestamp: "2026-06-09T09:55:00.000Z",
      },
    };

    const result = validateEvent("ingestion/work-item.created", event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("originalId"))).toBe(true);
  });

  it("throws on unknown schema path", () => {
    expect(() =>
      validateEvent("nonexistent/fake.event", {}),
    ).toThrow();
  });
});

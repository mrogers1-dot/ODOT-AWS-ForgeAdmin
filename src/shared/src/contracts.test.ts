import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CONTRACTS_DIR = resolve(__dirname, "../../../contracts/events");

const EXPECTED_SCHEMAS = [
  "ingestion/work-item.created.schema.json",
  "orchestration/triage.completed.schema.json",
  "orchestration/plan.proposed.schema.json",
  "orchestration/verification.completed.schema.json",
  "orchestration/work-item.resolved.schema.json",
  "dashboard/plan.approved.schema.json",
  "dashboard/plan.rejected.schema.json",
  "dashboard/module.state-changed.schema.json",
  "dashboard/approval.decision.schema.json",
  "dashboard/skill.updated.schema.json",
  "dashboard/steering.updated.schema.json",
  "execution/execution.completed.schema.json",
  "execution/execution.failed.schema.json",
  "knowledge-base/runbook.generated.schema.json",
  "knowledge-base/kb.updated.schema.json",
  "platform/circuit-breaker.tripped.schema.json",
  "platform/audit.entry-created.schema.json",
  "platform/dlq.message-received.schema.json",
  "communication/notification.sent.schema.json",
  "communication/notification.failed.schema.json",
  "correlation/work-item.correlated.schema.json",
  "correlation/correlation-group.detected.schema.json",
  "correlation/correlation-group.updated.schema.json",
  "knowledge-base/feedback.captured.schema.json",
  "orchestration/feedback.summary-updated.schema.json",
];

// Required top-level fields for EventEnvelope standard
const ENVELOPE_REQUIRED = ["version", "correlationId", "timestamp", "source", "detailType", "payload"];

describe("Event Contract Schemas", () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  it("all expected schema files exist", () => {
    const missing: string[] = [];
    for (const schema of EXPECTED_SCHEMAS) {
      const path = resolve(CONTRACTS_DIR, schema);
      if (!existsSync(path)) {
        missing.push(schema);
      }
    }
    expect(missing, `Missing schemas:\n${missing.join("\n")}`).toEqual([]);
  });

  describe.each(EXPECTED_SCHEMAS)("%s", (schemaPath) => {
    const fullPath = resolve(CONTRACTS_DIR, schemaPath);

    it("is valid JSON", () => {
      expect(existsSync(fullPath), `File not found: ${fullPath}`).toBe(true);
      const content = readFileSync(fullPath, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it("is a valid JSON Schema (compiles without error)", () => {
      if (!existsSync(fullPath)) return;
      const schema = JSON.parse(readFileSync(fullPath, "utf-8"));
      expect(() => ajv.compile(schema)).not.toThrow();
    });

    it("follows EventEnvelope standard (has required top-level fields)", () => {
      if (!existsSync(fullPath)) return;
      const schema = JSON.parse(readFileSync(fullPath, "utf-8"));

      expect(schema.type).toBe("object");
      expect(schema.required).toBeDefined();

      for (const field of ENVELOPE_REQUIRED) {
        expect(
          schema.required,
          `Schema missing required field: ${field}`,
        ).toContain(field);
        expect(
          schema.properties,
          `Schema missing property definition: ${field}`,
        ).toHaveProperty(field);
      }
    });

    it("has a payload property that is an object with its own required fields", () => {
      if (!existsSync(fullPath)) return;
      const schema = JSON.parse(readFileSync(fullPath, "utf-8"));
      const payload = schema.properties?.payload;

      expect(payload).toBeDefined();
      expect(payload.type).toBe("object");
      expect(payload.required).toBeDefined();
      expect(payload.required.length).toBeGreaterThan(0);
    });
  });
});

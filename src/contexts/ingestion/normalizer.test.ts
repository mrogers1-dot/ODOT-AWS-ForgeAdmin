import { describe, it, expect } from "vitest";
import { normalizeServiceNow, normalizeEmail, normalizeFortiSIEM } from "./normalizer";
import type { WorkItem } from "./models";

describe("normalizer", () => {
  describe("normalizeServiceNow", () => {
    it("transforms ServiceNow payload into WorkItem format", () => {
      const payload = {
        number: "INC0012345",
        short_description: "Server web-01 disk full",
        description: "Disk usage at 95% on /var partition",
        priority: "2",
        urgency: "2",
        cmdb_ci: "web-server-01",
        opened_by: "john.doe",
        opened_at: "2026-06-09T08:00:00Z",
      };

      const result = normalizeServiceNow(payload);

      expect(result.sourceSystem).toBe("servicenow");
      expect(result.originalId).toBe("INC0012345");
      expect(result.title).toBe("Server web-01 disk full");
      expect(result.description).toBe("Disk usage at 95% on /var partition");
      expect(result.priority).toBe("2");
      expect(result.urgency).toBe("2");
      expect(result.affectedSystem).toBe("web-server-01");
      expect(result.reporter).toBe("john.doe");
      expect(result.sourceTimestamp).toBe("2026-06-09T08:00:00Z");
      expect(result.workItemId).toBeDefined();
    });
  });

  describe("normalizeEmail", () => {
    it("transforms email payload into WorkItem format", () => {
      const payload = {
        from: "admin@dot.ohio.gov",
        subject: "DNS resolution failing for internal services",
        body: "Multiple users reporting DNS failures since 7AM",
        receivedAt: "2026-06-09T07:30:00Z",
      };

      const result = normalizeEmail(payload);

      expect(result.sourceSystem).toBe("email");
      expect(result.originalId).toBeDefined();
      expect(result.title).toBe("DNS resolution failing for internal services");
      expect(result.description).toBe("Multiple users reporting DNS failures since 7AM");
      expect(result.reporter).toBe("admin@dot.ohio.gov");
      expect(result.sourceTimestamp).toBe("2026-06-09T07:30:00Z");
    });

    it("handles missing subject with fallback title", () => {
      const payload = {
        from: "user@dot.ohio.gov",
        subject: "",
        body: "Something is broken",
        receivedAt: "2026-06-09T09:00:00Z",
      };

      const result = normalizeEmail(payload);

      expect(result.title).toBe("[No Subject]");
      expect(result.metadata?.flaggedForReview).toBe(true);
    });
  });

  describe("normalizeFortiSIEM", () => {
    it("transforms FortiSIEM webhook payload into WorkItem format", () => {
      const payload = {
        incidentId: "SIEM-9876",
        eventType: "Brute Force Login Attempt",
        severity: "HIGH",
        targetHost: "dc-01.dot.ohio.gov",
        detail: "50 failed login attempts from 10.0.5.23 in 5 minutes",
        timestamp: "2026-06-09T06:45:00Z",
      };

      const result = normalizeFortiSIEM(payload);

      expect(result.sourceSystem).toBe("fortisiem");
      expect(result.originalId).toBe("SIEM-9876");
      expect(result.title).toBe("Brute Force Login Attempt");
      expect(result.description).toBe("50 failed login attempts from 10.0.5.23 in 5 minutes");
      expect(result.priority).toBe("HIGH");
      expect(result.affectedSystem).toBe("dc-01.dot.ohio.gov");
      expect(result.sourceTimestamp).toBe("2026-06-09T06:45:00Z");
    });
  });
});

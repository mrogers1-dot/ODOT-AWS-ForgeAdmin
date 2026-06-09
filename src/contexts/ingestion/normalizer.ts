/**
 * Normalizes payloads from various source systems into a common WorkItem format.
 */

import { randomUUID } from "node:crypto";
import type { WorkItem, ServiceNowPayload, EmailPayload, FortiSIEMPayload } from "./models";

export function normalizeServiceNow(payload: ServiceNowPayload): WorkItem {
  return {
    workItemId: randomUUID(),
    sourceSystem: "servicenow",
    originalId: payload.number,
    title: payload.short_description,
    description: payload.description,
    priority: payload.priority,
    urgency: payload.urgency,
    affectedSystem: payload.cmdb_ci,
    reporter: payload.opened_by,
    sourceTimestamp: payload.opened_at,
  };
}

export function normalizeEmail(payload: EmailPayload): WorkItem {
  const hasSubject = payload.subject && payload.subject.trim().length > 0;

  return {
    workItemId: randomUUID(),
    sourceSystem: "email",
    originalId: payload.messageId ?? randomUUID(),
    title: hasSubject ? payload.subject : "[No Subject]",
    description: payload.body,
    reporter: payload.from,
    sourceTimestamp: payload.receivedAt,
    metadata: hasSubject ? undefined : { flaggedForReview: true },
  };
}

export function normalizeFortiSIEM(payload: FortiSIEMPayload): WorkItem {
  return {
    workItemId: randomUUID(),
    sourceSystem: "fortisiem",
    originalId: payload.incidentId,
    title: payload.eventType,
    description: payload.detail,
    priority: payload.severity,
    affectedSystem: payload.targetHost,
    sourceTimestamp: payload.timestamp,
  };
}

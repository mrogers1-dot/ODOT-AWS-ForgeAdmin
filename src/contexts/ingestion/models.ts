/**
 * Ingestion context domain models.
 */

export interface WorkItem {
  workItemId: string;
  sourceSystem: "servicenow" | "email" | "fortisiem";
  originalId: string;
  title: string;
  description: string;
  priority?: string;
  urgency?: string;
  affectedSystem?: string;
  reporter?: string;
  sourceTimestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ServiceNowPayload {
  number: string;
  short_description: string;
  description: string;
  priority?: string;
  urgency?: string;
  cmdb_ci?: string;
  opened_by?: string;
  opened_at: string;
}

export interface EmailPayload {
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  messageId?: string;
}

export interface FortiSIEMPayload {
  incidentId: string;
  eventType: string;
  severity: string;
  targetHost?: string;
  detail: string;
  timestamp: string;
}

export type DuplicateLookup = (sourceSystem: string, originalId: string) => Promise<boolean>;

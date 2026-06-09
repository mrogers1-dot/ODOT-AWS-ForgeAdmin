import { randomUUID } from "node:crypto";

export interface AuditEvent {
  actor: string;
  action: string;
  context: string;
  resourceId?: string;
  serviceNowTicketId?: string;
  details?: Record<string, unknown>;
}

export interface AuditEntry {
  entryId: string;
  actor: string;
  action: string;
  context: string;
  recordedAt: string;
  resourceId?: string;
  serviceNowTicketId?: string;
  details?: Record<string, unknown>;
}

export type WriteFn = (entry: AuditEntry) => Promise<void>;

export async function handleAuditEvent(event: AuditEvent, write: WriteFn): Promise<AuditEntry> {
  const entry: AuditEntry = {
    entryId: randomUUID(),
    actor: event.actor,
    action: event.action,
    context: event.context,
    recordedAt: new Date().toISOString(),
    resourceId: event.resourceId,
    serviceNowTicketId: event.serviceNowTicketId,
    details: event.details,
  };
  await write(entry);
  return Object.freeze(entry);
}

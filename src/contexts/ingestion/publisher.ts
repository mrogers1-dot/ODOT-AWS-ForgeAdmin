/**
 * Ingestion Publisher — creates event envelopes for work item creation.
 */

import { randomUUID } from "node:crypto";
import type { WorkItem } from "./models";
import type { EventEnvelope } from "@forgeadmin/shared";

export function createWorkItemCreatedEvent(workItem: WorkItem, correlationId?: string): EventEnvelope {
  return {
    version: "1.0.0",
    correlationId: correlationId ?? randomUUID(),
    timestamp: new Date().toISOString(),
    source: "forgeadmin.ingestion",
    detailType: "work-item.created",
    payload: { ...workItem },
  };
}

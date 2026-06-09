import type { IEventPublisher } from "../domain/ports/IEventPublisher";
import type { EventEnvelope } from "@forgeadmin/shared";

export class EventBridgePublisher implements IEventPublisher {
  constructor(private readonly busName: string) {}

  async publish(event: EventEnvelope): Promise<void> {
    // In production: calls EventBridge PutEvents API
    // For now: validates event structure
    const _schemaPath = `${event.source.replace("forgeadmin.", "")}/${event.detailType}`;
    // Validation would happen here in production
    return;
  }
}

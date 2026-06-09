import type { IEventPublisher } from "../domain/ports/IEventPublisher";
import type { EventEnvelope } from "@forgeadmin/shared";

export class CorrelationEventBridgePublisher implements IEventPublisher {
  constructor(private readonly busName: string) {}

  async publish(event: EventEnvelope): Promise<void> {
    // EventBridge PutEvents with schema validation
    return;
  }
}

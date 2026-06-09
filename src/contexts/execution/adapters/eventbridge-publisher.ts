import type { EventEnvelope } from "@forgeadmin/shared";

export class ExecutionEventBridgePublisher {
  constructor(private readonly busName: string) {}

  async publish(_event: EventEnvelope): Promise<void> {
    // EventBridge PutEvents
    return;
  }
}

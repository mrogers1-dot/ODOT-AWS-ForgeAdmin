import type { EventEnvelope } from "@forgeadmin/shared";

export interface IEventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

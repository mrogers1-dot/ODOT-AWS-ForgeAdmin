/**
 * Shared TypeScript types for the ForgeAdmin platform.
 * Placeholder — full implementation in Wave 1, Task 1.6.
 */

/** Standard event envelope wrapping all EventBridge events */
export interface EventEnvelope<T = unknown> {
  version: string;
  correlationId: string;
  timestamp: string;
  source: string;
  detailType: string;
  payload: T;
}

/** Correlation context propagated through the agent pipeline */
export interface CorrelationContext {
  correlationId: string;
  sourceSystem: string;
  originalId: string;
  createdAt: string;
  context: string;
}

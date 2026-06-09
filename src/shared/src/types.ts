/**
 * Shared TypeScript types for the ForgeAdmin platform.
 */

// =============================================================================
// Event Envelope — Standard wrapper for all EventBridge events
// =============================================================================

export interface EventEnvelope<T = unknown> {
  /** Schema version (semver, e.g. "1.0.0") */
  version: string;
  /** Unique correlation ID for distributed tracing */
  correlationId: string;
  /** ISO 8601 timestamp of event creation */
  timestamp: string;
  /** Source context that produced the event */
  source: string;
  /** Event type identifier (e.g. "work-item.created") */
  detailType: string;
  /** Event-specific payload */
  payload: T;
}

// =============================================================================
// Correlation Context — Propagated through the agent pipeline
// =============================================================================

export interface CorrelationContext {
  correlationId: string;
  sourceSystem: string;
  originalId: string;
  createdAt: string;
  context: string;
}

// =============================================================================
// Log Levels
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

// =============================================================================
// Work Item — Cross-context representation
// =============================================================================

export interface WorkItemPayload {
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

// =============================================================================
// Classification — Output of the Triage Agent
// =============================================================================

export type WorkItemCategory =
  | "account_service_request"
  | "health_remediation"
  | "security_alert"
  | "knowledge_capture";

export type RiskLevel = "low" | "medium" | "high";

export type UrgencyLevel = "critical" | "high" | "normal" | "low";

// =============================================================================
// Metric Dimensions
// =============================================================================

export interface MetricDimensions {
  [key: string]: string;
}

// =============================================================================
// Utility Types
// =============================================================================

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type UUID = Brand<string, "UUID">;

/**
 * Group Finalizer — determines whether a session forms a correlation group.
 */

import { randomUUID } from "node:crypto";
import type { CorrelationSession } from "../models/correlation-session";
import type { CorrelationGroup } from "../models/correlation-group";
import type { CorrelationRule } from "../models/correlation-rule";

export interface FinalizerResult {
  formed: boolean;
  group?: CorrelationGroup;
  dissolvedItems?: string[];
}

export function finalizeSession(session: CorrelationSession, rule: CorrelationRule): FinalizerResult {
  if (session.items.length < rule.minItems) {
    return { formed: false, dissolvedItems: [...session.items] };
  }

  const group: CorrelationGroup = {
    groupId: randomUUID(),
    ruleId: rule.id,
    action: rule.action,
    memberItems: [...session.items],
    parentWorkItem: rule.action === "merge" ? randomUUID() : undefined,
    suggestedRootCause: `Correlated by rule "${rule.name}" — ${session.items.length} related items detected.`,
    formedAt: new Date().toISOString(),
  };

  return { formed: true, group };
}

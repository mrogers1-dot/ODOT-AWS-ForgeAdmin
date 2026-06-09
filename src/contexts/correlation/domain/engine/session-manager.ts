/**
 * Session Manager — manages correlation sessions (create or add to existing).
 */

import type { ISessionStore } from "../ports/ISessionStore";
import type { CorrelationRule } from "../models/correlation-rule";
import { createSession, addItemToSession, type CorrelationSession } from "../models/correlation-session";

export interface SessionManagerResult {
  session: CorrelationSession;
  isNew: boolean;
}

export async function manageSession(
  store: ISessionStore,
  rule: CorrelationRule,
  matchKey: string,
  workItemId: string,
): Promise<SessionManagerResult> {
  const existing = await store.getByRuleAndMatchKey(rule.id, matchKey);

  if (existing) {
    const updated = addItemToSession(existing, workItemId);
    await store.save(updated);
    return { session: updated, isNew: false };
  }

  const newSession = createSession(rule.id, matchKey, workItemId);
  await store.save(newSession);
  return { session: newSession, isNew: true };
}

/**
 * CorrelationSession entity — tracks a group of related work items being correlated.
 */

import { randomUUID } from "node:crypto";

export interface CorrelationSession {
  readonly sessionId: string;
  readonly ruleId: string;
  readonly matchKey: string;
  readonly status: "open" | "closed";
  readonly items: readonly string[];
  readonly openedAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt?: string;
}

export function createSession(
  ruleId: string,
  matchKey: string,
  firstItemId: string,
): CorrelationSession {
  const now = new Date().toISOString();
  return Object.freeze({
    sessionId: randomUUID(),
    ruleId,
    matchKey,
    status: "open",
    items: Object.freeze([firstItemId]),
    openedAt: now,
    lastActivityAt: now,
  });
}

export function addItemToSession(
  session: CorrelationSession,
  itemId: string,
): CorrelationSession {
  if (session.items.includes(itemId)) {
    return session;
  }
  return Object.freeze({
    ...session,
    items: Object.freeze([...session.items, itemId]),
    lastActivityAt: new Date().toISOString(),
  });
}

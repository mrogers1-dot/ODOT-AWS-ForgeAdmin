/**
 * Lambda handler: EventBridge Scheduler callback when a session's gap timer expires.
 */

import { finalizeSession } from "../domain/engine/group-finalizer";
import type { ISessionStore } from "../domain/ports/ISessionStore";
import type { IRuleProvider } from "../domain/ports/IRuleProvider";
import type { IEventPublisher } from "../domain/ports/IEventPublisher";

export interface SessionExpiredDeps {
  sessionStore: ISessionStore;
  ruleProvider: IRuleProvider;
  publisher: IEventPublisher;
}

export async function handleSessionExpired(
  sessionId: string,
  ruleId: string,
  deps: SessionExpiredDeps,
): Promise<{ finalized: boolean }> {
  // In production: fetch session, check if extended since timer set, finalize if truly expired
  return { finalized: false };
}

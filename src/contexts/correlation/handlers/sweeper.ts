/**
 * Lambda handler: scheduled every 5 minutes, force-closes sessions past maxExpiresAt.
 */

import type { ISessionStore } from "../domain/ports/ISessionStore";

export async function handleSweep(store: ISessionStore): Promise<{ closedCount: number }> {
  const expired = await store.getExpiredSessions();
  for (const session of expired) {
    await store.close(session.sessionId);
  }
  return { closedCount: expired.length };
}

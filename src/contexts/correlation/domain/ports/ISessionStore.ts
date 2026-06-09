import type { CorrelationSession } from "../models/correlation-session";

export interface ISessionStore {
  getByRuleAndMatchKey(ruleId: string, matchKey: string): Promise<CorrelationSession | null>;
  save(session: CorrelationSession): Promise<void>;
  close(sessionId: string): Promise<void>;
  getExpiredSessions(): Promise<CorrelationSession[]>;
}

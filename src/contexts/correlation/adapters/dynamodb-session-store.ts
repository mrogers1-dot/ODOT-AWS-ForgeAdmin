import type { ISessionStore } from "../domain/ports/ISessionStore";
import type { CorrelationSession } from "../domain/models/correlation-session";

export class DynamoDBSessionStore implements ISessionStore {
  constructor(private readonly tableName: string) {}

  async getByRuleAndMatchKey(ruleId: string, matchKey: string): Promise<CorrelationSession | null> {
    // DynamoDB Query on GSI ruleId-matchKey-index
    return null;
  }

  async save(session: CorrelationSession): Promise<void> {
    // DynamoDB PutItem
    return;
  }

  async close(sessionId: string): Promise<void> {
    // DynamoDB UpdateItem status=closed
    return;
  }

  async getExpiredSessions(): Promise<CorrelationSession[]> {
    // Query for sessions past maxExpiresAt
    return [];
  }
}

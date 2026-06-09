import type { IHistoryLookup, HistoricalMatch } from "../domain/ports/IHistoryLookup";

export class DynamoDBHistoryLookup implements IHistoryLookup {
  constructor(private readonly tableName: string) {}

  async findSimilar(category: string, errorCode: string, lookbackDays: number): Promise<HistoricalMatch[]> {
    // DynamoDB Query by category + errorCode within lookback window
    return [];
  }
}

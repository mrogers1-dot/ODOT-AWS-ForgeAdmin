export interface HistoricalMatch {
  readonly itemId: string;
  readonly matchedAt: string;
  readonly similarity: number;
}

export interface IHistoryLookup {
  findSimilar(category: string, errorCode: string, lookbackDays: number): Promise<HistoricalMatch[]>;
}

export interface CorrelationContext {
  groupId?: string;
  ruleMatched?: string;
  action: "merge" | "enrich" | "passthrough";
  relatedItems?: string[];
  historicalMatch?: boolean;
}

export interface IWorkItemEnricher {
  enrich(workItemId: string, context: CorrelationContext): Promise<void>;
}

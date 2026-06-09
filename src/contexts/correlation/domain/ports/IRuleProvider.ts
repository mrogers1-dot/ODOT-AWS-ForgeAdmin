import type { CorrelationRule } from "../models/correlation-rule";

export interface IRuleProvider {
  getActiveRules(): Promise<CorrelationRule[]>;
}

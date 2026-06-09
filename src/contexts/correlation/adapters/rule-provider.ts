import type { IRuleProvider } from "../domain/ports/IRuleProvider";
import type { CorrelationRule } from "../domain/models/correlation-rule";

export class RuleProvider implements IRuleProvider {
  constructor(
    private readonly codeDefaults: CorrelationRule[],
    private readonly tableName?: string,
  ) {}

  async getActiveRules(): Promise<CorrelationRule[]> {
    // Merge: code defaults + DynamoDB overrides (dashboard wins on same ID)
    // For now, return code defaults
    return this.codeDefaults.filter(rule => rule.enabled);
  }
}

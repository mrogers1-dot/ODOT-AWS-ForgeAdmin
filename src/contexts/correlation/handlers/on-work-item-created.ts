/**
 * Lambda handler: processes work-item.created events through correlation engine.
 * SQS trigger → evaluate rules → manage session → publish enriched event.
 */

import { evaluateRules, type EvaluationInput } from "../domain/engine/rule-evaluator";
import { manageSession } from "../domain/engine/session-manager";
import type { ISessionStore } from "../domain/ports/ISessionStore";
import type { IRuleProvider } from "../domain/ports/IRuleProvider";
import type { IEventPublisher } from "../domain/ports/IEventPublisher";

export interface CorrelationHandlerDeps {
  ruleProvider: IRuleProvider;
  sessionStore: ISessionStore;
  publisher: IEventPublisher;
}

export async function handleWorkItemCreated(
  workItemId: string,
  input: EvaluationInput,
  deps: CorrelationHandlerDeps,
): Promise<{ action: "correlated" | "passthrough"; matchedRule?: string }> {
  const rules = await deps.ruleProvider.getActiveRules();
  const evaluation = evaluateRules(rules, input);

  if (!evaluation.matchedRule || !evaluation.matchKey) {
    // No match — passthrough
    return { action: "passthrough" };
  }

  // Manage session
  await manageSession(deps.sessionStore, evaluation.matchedRule, evaluation.matchKey, workItemId);

  return { action: "correlated", matchedRule: evaluation.matchedRule.id };
}

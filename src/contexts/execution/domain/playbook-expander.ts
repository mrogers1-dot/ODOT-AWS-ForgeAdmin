/**
 * Playbook Expander — resolves playbook-ref steps into flat execution steps.
 */

export interface PlaybookStep {
  stepIndex: number;
  type: "custom" | "playbook-ref";
  description: string;
  expectedOutcome: string;
  rollback: string;
  playbookId?: string;
  parameterValues?: Record<string, string>;
}

export interface ExpandedStep {
  stepIndex: string; // hierarchical: "1", "2.1", "2.2", etc.
  description: string;
  expectedOutcome: string;
  rollback: string;
}

export interface PlaybookDefinition {
  id: string;
  steps: Array<{
    description: string;
    expectedOutcome: string;
    rollback: string;
  }>;
}

export type PlaybookResolver = (playbookId: string) => Promise<PlaybookDefinition | null>;

const MAX_DEPTH = 3;

export async function expandPlan(
  steps: PlaybookStep[],
  resolver: PlaybookResolver,
  depth = 0,
): Promise<ExpandedStep[]> {
  if (depth > MAX_DEPTH) {
    throw new Error(`Playbook nesting depth exceeded maximum of ${MAX_DEPTH}`);
  }

  const result: ExpandedStep[] = [];

  for (const step of steps) {
    if (step.type === "custom") {
      result.push({
        stepIndex: String(step.stepIndex),
        description: step.description,
        expectedOutcome: step.expectedOutcome,
        rollback: step.rollback,
      });
    } else if (step.type === "playbook-ref" && step.playbookId) {
      const playbook = await resolver(step.playbookId);
      if (!playbook) {
        throw new Error(`Playbook not found: ${step.playbookId}`);
      }

      for (let i = 0; i < playbook.steps.length; i++) {
        const ps = playbook.steps[i];
        result.push({
          stepIndex: `${step.stepIndex}.${i + 1}`,
          description: ps.description,
          expectedOutcome: ps.expectedOutcome,
          rollback: ps.rollback,
        });
      }
    }
  }

  return result;
}

/**
 * Execution Orchestrator — executes plan steps in order with rollback on failure.
 */

export interface ExecutionStep {
  stepIndex: number;
  command: string;
  expectedOutcome: string;
  rollback: string;
}

export interface StepExecutionResult {
  stepIndex: number;
  success: boolean;
  output: string;
}

export type ExecuteCommand = (command: string) => Promise<StepExecutionResult>;

export interface ExecutionResult {
  success: boolean;
  stepsCompleted: number;
  failedAtStep?: number;
  error?: string;
  rollbackInitiated: boolean;
}

export async function executeOrchestration(
  steps: ExecutionStep[],
  execute: ExecuteCommand,
): Promise<ExecutionResult> {
  const completed: ExecutionStep[] = [];

  for (const step of steps) {
    const result = await execute(step.command);
    if (!result.success) {
      // Rollback completed steps in reverse
      for (const completedStep of [...completed].reverse()) {
        await execute(completedStep.rollback);
      }
      return {
        success: false,
        stepsCompleted: completed.length,
        failedAtStep: step.stepIndex,
        error: result.output,
        rollbackInitiated: completed.length > 0,
      };
    }
    completed.push(step);
  }

  return { success: true, stepsCompleted: steps.length, rollbackInitiated: false };
}

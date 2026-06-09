export interface StartExecutionFn {
  (workItemId: string, input: Record<string, unknown>): Promise<{ executionId: string }>;
}

export interface HandlerResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

export async function handleWorkItemCreated(
  event: { workItemId?: string; payload?: Record<string, unknown> },
  startExecution: StartExecutionFn,
): Promise<HandlerResult> {
  if (!event.workItemId) {
    return { success: false, error: "Missing workItemId" };
  }
  const result = await startExecution(event.workItemId, event.payload ?? {});
  return { success: true, executionId: result.executionId };
}

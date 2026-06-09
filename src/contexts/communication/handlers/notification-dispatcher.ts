export interface NotificationPayload {
  type: "auto-executed" | "approval-request" | "execution-failure" | "system-alert";
  channel: "teams" | "slack";
  message: string;
  workItemId?: string;
  planSummary?: string;
}

export type SendFn = (channel: string, message: string) => Promise<void>;

export interface DispatchResult {
  delivered: boolean;
  attempts: number;
  escalated: boolean;
  error?: string;
}

export async function dispatch(
  payload: NotificationPayload,
  send: SendFn,
  maxRetries = 3,
): Promise<DispatchResult> {
  const fullMessage = payload.planSummary
    ? `${payload.message}\n\nPlan Summary: ${payload.planSummary}`
    : payload.message;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await send(payload.channel, fullMessage);
      return { delivered: true, attempts: attempt, escalated: false };
    } catch (err) {
      if (attempt === maxRetries) {
        return { delivered: false, attempts: attempt, escalated: true, error: (err as Error).message };
      }
    }
  }
  return { delivered: false, attempts: maxRetries, escalated: true, error: "Max retries exceeded" };
}

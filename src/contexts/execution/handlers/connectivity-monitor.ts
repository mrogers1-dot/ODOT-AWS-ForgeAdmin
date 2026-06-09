/**
 * Transit Gateway connectivity monitor.
 *
 * Checks health of on-prem connection and determines queue/escalate actions.
 */

export type HealthCheckFn = () => Promise<boolean>;

export interface ConnectivityResult {
  connected: boolean;
  action: "none" | "queue" | "escalate";
  checkedAt: string;
}

export async function checkConnectivity(healthCheck: HealthCheckFn): Promise<ConnectivityResult> {
  const checkedAt = new Date().toISOString();

  try {
    const connected = await healthCheck();
    if (connected) {
      return { connected: true, action: "none", checkedAt };
    }
    return { connected: false, action: "queue", checkedAt };
  } catch {
    return { connected: false, action: "queue", checkedAt };
  }
}

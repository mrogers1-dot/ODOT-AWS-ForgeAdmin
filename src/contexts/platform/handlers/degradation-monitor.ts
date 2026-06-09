export interface ComponentHealth {
  componentId: string;
  status: "healthy" | "degraded" | "failed";
  degradedSince?: string;
  recoveredAt?: string;
  totalDegradedMs?: number;
}

export function markDegraded(componentId: string): ComponentHealth {
  return { componentId, status: "degraded", degradedSince: new Date().toISOString() };
}

export function markRecovered(current: ComponentHealth): ComponentHealth {
  const now = new Date();
  const degradedSince = current.degradedSince ? new Date(current.degradedSince) : now;
  return {
    componentId: current.componentId,
    status: "healthy",
    recoveredAt: now.toISOString(),
    totalDegradedMs: now.getTime() - degradedSince.getTime(),
  };
}

export function isHealthy(health: ComponentHealth): boolean {
  return health.status === "healthy";
}

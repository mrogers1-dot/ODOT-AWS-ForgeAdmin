import { describe, it, expect, vi } from "vitest";
import { checkConnectivity, type ConnectivityResult, type HealthCheckFn } from "./connectivity-monitor";

describe("Transit Gateway Connectivity Monitor", () => {
  it("healthy connection reports ok status", async () => {
    const healthCheck: HealthCheckFn = vi.fn().mockResolvedValue(true);
    const result = await checkConnectivity(healthCheck);
    expect(result.connected).toBe(true);
    expect(result.action).toBe("none");
  });

  it("connection loss returns disconnected with queue action", async () => {
    const healthCheck: HealthCheckFn = vi.fn().mockResolvedValue(false);
    const result = await checkConnectivity(healthCheck);
    expect(result.connected).toBe(false);
    expect(result.action).toBe("queue");
  });

  it("health check exception treats as disconnected", async () => {
    const healthCheck: HealthCheckFn = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await checkConnectivity(healthCheck);
    expect(result.connected).toBe(false);
    expect(result.action).toBe("queue");
  });
});

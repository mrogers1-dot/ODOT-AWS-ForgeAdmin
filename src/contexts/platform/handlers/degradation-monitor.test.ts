import { describe, it, expect } from "vitest";
import { markDegraded, markRecovered, isHealthy, type ComponentHealth } from "./degradation-monitor";

describe("Graceful Degradation Monitor", () => {
  it("healthy component reports no degradation", () => {
    const health: ComponentHealth = { componentId: "api-gateway", status: "healthy" };
    expect(isHealthy(health)).toBe(true);
    expect(health.degradedSince).toBeUndefined();
  });

  it("failed component marks as degraded", () => {
    const degraded = markDegraded("api-gateway");

    expect(degraded.status).toBe("degraded");
    expect(degraded.degradedSince).toBeDefined();
    expect(isHealthy(degraded)).toBe(false);
  });

  it("recovery clears degradation and records duration", () => {
    const degraded = markDegraded("api-gateway");
    const recovered = markRecovered(degraded);

    expect(recovered.status).toBe("healthy");
    expect(isHealthy(recovered)).toBe(true);
    expect(recovered.recoveredAt).toBeDefined();
    expect(typeof recovered.totalDegradedMs).toBe("number");
    expect(recovered.totalDegradedMs).toBeGreaterThanOrEqual(0);
  });
});

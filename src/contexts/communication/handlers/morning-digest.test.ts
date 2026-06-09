import { describe, it, expect } from "vitest";
import { generateDigest, type DigestInput } from "./morning-digest";

describe("Morning Digest", () => {
  it("compiles overnight activity into digest message", () => {
    const input: DigestInput = {
      overnightActions: 12,
      pendingApprovals: 3,
      moduleHealth: { healthy: 5, degraded: 1 },
      anomalies: ["DNS latency spike at 03:22"],
    };

    const result = generateDigest(input);

    expect(result.hasActivity).toBe(true);
    expect(result.message).toContain("ForgeAdmin Morning Digest");
    expect(result.message).toContain("Overnight actions: 12");
    expect(result.message).toContain("DNS latency spike at 03:22");
  });

  it("includes pending approvals count", () => {
    const input: DigestInput = {
      overnightActions: 5,
      pendingApprovals: 7,
      moduleHealth: { healthy: 4, degraded: 2 },
      anomalies: [],
    };

    const result = generateDigest(input);

    expect(result.message).toContain("Pending approvals: 7");
  });

  it("empty overnight produces 'no activity' message", () => {
    const input: DigestInput = {
      overnightActions: 0,
      pendingApprovals: 0,
      moduleHealth: { healthy: 6, degraded: 0 },
      anomalies: [],
    };

    const result = generateDigest(input);

    expect(result.hasActivity).toBe(false);
    expect(result.message).toContain("No overnight activity");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transitionState, isGracePeriodExpired, type ModuleState } from "./module-manager";

describe("Module State Manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("valid transition enabled→disabled succeeds", () => {
    const current: ModuleState = { moduleId: "mod-1", state: "enabled" };
    const result = transitionState(current, "disabled");
    expect(result.success).toBe(true);
    expect(result.newState?.state).toBe("disabled");
  });

  it("invalid transition disabled→disabled fails", () => {
    const current: ModuleState = { moduleId: "mod-1", state: "disabled" };
    const result = transitionState(current, "disabled");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid transition");
  });

  it("disable starts 300-second grace period", () => {
    const current: ModuleState = { moduleId: "mod-1", state: "enabled" };
    const result = transitionState(current, "disabled");
    expect(result.gracePeriodStarted).toBe(true);
    expect(result.newState?.gracePeriodEndsAt).toBeDefined();

    // Grace period should be 300 seconds from now
    const expectedEnd = new Date("2025-01-15T10:05:00.000Z").toISOString();
    expect(result.newState?.gracePeriodEndsAt).toBe(expectedEnd);
  });

  it("grace period expiry triggers force-stop", () => {
    const current: ModuleState = { moduleId: "mod-1", state: "enabled" };
    const result = transitionState(current, "disabled");

    // Before expiry
    expect(isGracePeriodExpired(result.newState!)).toBe(false);

    // Advance time past 300 seconds
    vi.setSystemTime(new Date("2025-01-15T10:05:01.000Z"));
    expect(isGracePeriodExpired(result.newState!)).toBe(true);
  });
});

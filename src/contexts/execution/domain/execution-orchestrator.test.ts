import { describe, it, expect, vi } from "vitest";
import { executeOrchestration } from "./execution-orchestrator";
import type { ExecutionStep, ExecuteCommand } from "./execution-orchestrator";

function makeSteps(count: number): ExecutionStep[] {
  return Array.from({ length: count }, (_, i) => ({
    stepIndex: i,
    command: `run-step-${i}`,
    expectedOutcome: `step-${i}-done`,
    rollback: `rollback-step-${i}`,
  }));
}

describe("Execution Orchestrator", () => {
  it("successful plan executes all steps in order, returns success", async () => {
    const steps = makeSteps(3);
    const executionOrder: string[] = [];
    const execute: ExecuteCommand = vi.fn().mockImplementation(async (cmd: string) => {
      executionOrder.push(cmd);
      return { stepIndex: 0, success: true, output: "ok" };
    });

    const result = await executeOrchestration(steps, execute);

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(3);
    expect(result.rollbackInitiated).toBe(false);
    expect(executionOrder).toEqual(["run-step-0", "run-step-1", "run-step-2"]);
  });

  it("any step failure halts immediately, returns failure with failedAtStep", async () => {
    const steps = makeSteps(3);
    const execute: ExecuteCommand = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === "run-step-1") {
        return { stepIndex: 1, success: false, output: "command failed" };
      }
      return { stepIndex: 0, success: true, output: "ok" };
    });

    const result = await executeOrchestration(steps, execute);

    expect(result.success).toBe(false);
    expect(result.failedAtStep).toBe(1);
    expect(result.stepsCompleted).toBe(1);
    expect(result.error).toBe("command failed");
  });

  it("failure triggers rollback for completed steps", async () => {
    const steps = makeSteps(3);
    const executedCommands: string[] = [];
    const execute: ExecuteCommand = vi.fn().mockImplementation(async (cmd: string) => {
      executedCommands.push(cmd);
      if (cmd === "run-step-2") {
        return { stepIndex: 2, success: false, output: "error" };
      }
      return { stepIndex: 0, success: true, output: "ok" };
    });

    const result = await executeOrchestration(steps, execute);

    expect(result.success).toBe(false);
    expect(result.rollbackInitiated).toBe(true);
    // Should have rolled back step 1 then step 0 (reverse order)
    expect(executedCommands).toContain("rollback-step-1");
    expect(executedCommands).toContain("rollback-step-0");
    // Rollback should be in reverse order
    const rollback0Idx = executedCommands.indexOf("rollback-step-0");
    const rollback1Idx = executedCommands.indexOf("rollback-step-1");
    expect(rollback1Idx).toBeLessThan(rollback0Idx);
  });
});

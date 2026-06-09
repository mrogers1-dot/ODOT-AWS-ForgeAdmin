import { describe, it, expect, vi } from "vitest";
import { handleWorkItemCreated, type StartExecutionFn } from "./on-work-item-created";

describe("Orchestration — onWorkItemCreated Handler", () => {
  it("valid event starts orchestration (calls startExecution)", async () => {
    const startExecution: StartExecutionFn = vi.fn().mockResolvedValue({ executionId: "exec-001" });

    const result = await handleWorkItemCreated(
      { workItemId: "wi-100", payload: { priority: "high" } },
      startExecution,
    );

    expect(result.success).toBe(true);
    expect(result.executionId).toBe("exec-001");
    expect(startExecution).toHaveBeenCalledWith("wi-100", { priority: "high" });
  });

  it("invalid event returns error (does not start execution)", async () => {
    const startExecution: StartExecutionFn = vi.fn().mockResolvedValue({ executionId: "exec-002" });

    const result = await handleWorkItemCreated({}, startExecution);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Missing workItemId");
    expect(startExecution).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from "vitest";
import { updateKnowledgeBase } from "./kb-updater";
import type { KBUpdateInput, UpdateStoreFn } from "./kb-updater";

const baseInput: KBUpdateInput = {
  workItemId: "wi-001",
  resolutionSteps: ["Step 1", "Step 2"],
  rootCause: "Disk full",
  affectedSystems: ["web-server-01"],
};

describe("KB Updater", () => {
  it("successful update calls store with resolution data", async () => {
    const store: UpdateStoreFn = vi.fn().mockResolvedValue(undefined);

    const result = await updateKnowledgeBase(baseInput, store);

    expect(store).toHaveBeenCalledWith(baseInput);
    expect(result.success).toBe(true);
    expect(result.notifyFailure).toBe(false);
  });

  it("failed update retries 3 times", async () => {
    const store: UpdateStoreFn = vi.fn()
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValue(undefined);

    const result = await updateKnowledgeBase(baseInput, store);

    expect(store).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.notifyFailure).toBe(false);
  });

  it("persistent failure returns error with notification flag", async () => {
    const store: UpdateStoreFn = vi.fn().mockRejectedValue(new Error("Service unavailable"));

    const result = await updateKnowledgeBase(baseInput, store);

    expect(store).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
    expect(result.notifyFailure).toBe(true);
    expect(result.error).toContain("Service unavailable");
  });
});

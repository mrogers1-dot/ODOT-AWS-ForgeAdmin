import { describe, it, expect, vi } from "vitest";
import { captureFeedback, type FeedbackCaptureEvent, type StoreFn } from "./feedback-capture-handler";

describe("Feedback Capture Handler", () => {
  const validEvent: FeedbackCaptureEvent = {
    workItemId: "wi-200",
    planId: "plan-abc",
    outcomeType: "approved",
    category: "health_remediation",
    confidenceAtDecision: 85,
  };

  it("valid event produces feedback entry and stores it", async () => {
    const store: StoreFn = vi.fn().mockResolvedValue(undefined);
    const result = await captureFeedback(validEvent, store);

    expect(result.success).toBe(true);
    expect(result.feedbackId).toBeDefined();
    expect(store).toHaveBeenCalledTimes(1);

    const storedEntry = (store as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(storedEntry.workItemId).toBe("wi-200");
    expect(storedEntry.planId).toBe("plan-abc");
    expect(storedEntry.signal).toBe("positive");
    expect(storedEntry.outcomeType).toBe("approved");
    expect(storedEntry.confidenceAtDecision).toBe(85);
    expect(storedEntry.timestamp).toBeDefined();
  });

  it("mapping failure returns error (does not throw)", async () => {
    const store: StoreFn = vi.fn().mockRejectedValue(new Error("DynamoDB write failed"));
    const result = await captureFeedback(validEvent, store);

    expect(result.success).toBe(false);
    expect(result.error).toBe("DynamoDB write failed");
  });
});

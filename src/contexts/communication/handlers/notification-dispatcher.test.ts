import { describe, it, expect, vi } from "vitest";
import { dispatch, type NotificationPayload, type SendFn } from "./notification-dispatcher";

describe("Notification Dispatcher", () => {
  it("event routes to Teams/Slack channel (calls send function)", async () => {
    const send: SendFn = vi.fn().mockResolvedValue(undefined);
    const payload: NotificationPayload = {
      type: "system-alert",
      channel: "teams",
      message: "Server health degraded",
    };

    const result = await dispatch(payload, send);

    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.escalated).toBe(false);
    expect(send).toHaveBeenCalledWith("teams", "Server health degraded");
  });

  it("delivery failure retries 3 times", async () => {
    const send: SendFn = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(undefined);

    const payload: NotificationPayload = {
      type: "system-alert",
      channel: "slack",
      message: "Alert",
    };

    const result = await dispatch(payload, send);

    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("persistent failure after retries returns escalation result", async () => {
    const send: SendFn = vi.fn().mockRejectedValue(new Error("service unavailable"));

    const payload: NotificationPayload = {
      type: "execution-failure",
      channel: "teams",
      message: "Critical failure",
    };

    const result = await dispatch(payload, send);

    expect(result.delivered).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.escalated).toBe(true);
    expect(result.error).toBe("service unavailable");
  });

  it("auto-executed notification includes plan summary", async () => {
    const send: SendFn = vi.fn().mockResolvedValue(undefined);
    const payload: NotificationPayload = {
      type: "auto-executed",
      channel: "teams",
      message: "Work item WI-123 auto-executed",
      workItemId: "WI-123",
      planSummary: "Unlocked AD account for user jsmith",
    };

    const result = await dispatch(payload, send);

    expect(result.delivered).toBe(true);
    expect(send).toHaveBeenCalledWith(
      "teams",
      "Work item WI-123 auto-executed\n\nPlan Summary: Unlocked AD account for user jsmith",
    );
  });
});

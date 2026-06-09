import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMetrics, MetricUnits, withTiming } from "./metrics";

describe("createMetrics", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits CloudWatch EMF format with correct namespace and dimensions", () => {
    const metrics = createMetrics("ingestion");
    metrics.increment("WorkItemsIngested");
    metrics.flush();

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);

    expect(output._aws).toBeDefined();
    expect(output._aws.CloudWatchMetrics[0].Namespace).toBe("ForgeAdmin");
    expect(output._aws.CloudWatchMetrics[0].Dimensions).toEqual([["Context"]]);
    expect(output.Context).toBe("ingestion");
    expect(output.WorkItemsIngested).toBe(1);
  });

  it("records metric with specified unit", () => {
    const metrics = createMetrics("orchestration");
    metrics.record("PlanSteps", 5, MetricUnits.Count);
    metrics.flush();

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output._aws.CloudWatchMetrics[0].Metrics).toContainEqual({
      Name: "PlanSteps",
      Unit: "Count",
    });
    expect(output.PlanSteps).toBe(5);
  });

  it("recordDuration emits millisecond metric", () => {
    const metrics = createMetrics("execution");
    metrics.recordDuration("StepLatency", 1500);
    metrics.flush();

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output._aws.CloudWatchMetrics[0].Metrics).toContainEqual({
      Name: "StepLatency",
      Unit: "Milliseconds",
    });
    expect(output.StepLatency).toBe(1500);
  });

  it("flush does nothing when buffer is empty", () => {
    const metrics = createMetrics("platform");
    metrics.flush();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("flush clears buffer so subsequent flush emits nothing", () => {
    const metrics = createMetrics("ingestion");
    metrics.increment("Test");
    metrics.flush();
    metrics.flush();
    expect(stdoutSpy).toHaveBeenCalledOnce();
  });

  it("supports additional dimensions", () => {
    const metrics = createMetrics("orchestration", { Agent: "triage" });
    metrics.increment("Invocations");
    metrics.flush();

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output._aws.CloudWatchMetrics[0].Dimensions).toEqual([["Context", "Agent"]]);
    expect(output.Agent).toBe("triage");
  });
});

describe("withTiming", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records duration of async function", async () => {
    const metrics = createMetrics("test");
    const result = await withTiming(metrics, "OpDuration", async () => {
      return "done";
    });

    expect(result).toBe("done");
    metrics.flush();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.OpDuration).toBeGreaterThanOrEqual(0);
  });

  it("records duration and increments error counter on throw", async () => {
    const metrics = createMetrics("test");
    await expect(
      withTiming(metrics, "FailOp", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    metrics.flush();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.FailOp).toBeGreaterThanOrEqual(0);
    expect(output["FailOp.Error"]).toBe(1);
  });
});

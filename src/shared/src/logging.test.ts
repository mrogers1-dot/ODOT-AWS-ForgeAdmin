import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "./logging";

describe("createLogger", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs valid JSON with required fields (correlationId, context, action, level)", () => {
    const logger = createLogger("ingestion", "test-correlation-123");
    logger.info("ingest", "Processing work item");

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);

    expect(output).toMatchObject({
      level: "info",
      correlationId: "test-correlation-123",
      context: "ingestion",
      action: "ingest",
      message: "Processing work item",
    });
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("writes error-level logs to stderr", () => {
    const logger = createLogger("orchestration", "err-123");
    logger.error("triage", "Classification failed");

    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe("error");
  });

  it("includes metadata when provided", () => {
    const logger = createLogger("execution", "meta-456");
    logger.info("execute", "Step completed", { stepIndex: 3, duration: 1200 });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.metadata).toEqual({ stepIndex: 3, duration: 1200 });
  });

  it("extracts Error objects into structured error field", () => {
    const logger = createLogger("platform", "err-789");
    const error = new Error("Connection timeout");
    logger.error("connect", "Failed to reach DB", { error });

    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.error).toMatchObject({
      name: "Error",
      message: "Connection timeout",
    });
    expect(output.error.stack).toBeDefined();
    expect(output.metadata).toBeUndefined();
  });

  it("supports setCorrelationId to update correlation after creation", () => {
    const logger = createLogger("ingestion");
    logger.info("init", "Starting");
    let output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.correlationId).toBe("unset");

    logger.setCorrelationId("new-correlation-id");
    logger.info("process", "Continuing");
    output = JSON.parse(stdoutSpy.mock.calls[1][0] as string);
    expect(output.correlationId).toBe("new-correlation-id");
  });

  it("child() creates a logger with overridden context", () => {
    const parent = createLogger("orchestration", "parent-id");
    const child = parent.child({ context: "triage-agent" });
    child.info("classify", "Running classification");

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.context).toBe("triage-agent");
    expect(output.correlationId).toBe("parent-id");
  });
});

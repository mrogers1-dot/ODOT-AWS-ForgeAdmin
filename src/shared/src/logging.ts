/**
 * Structured JSON logger for ForgeAdmin Lambdas.
 *
 * Output format is JSON, compatible with CloudWatch Logs Insights.
 */

import type { LogLevel } from "./types";

export interface LogEntry {
  level: LogLevel;
  correlationId: string;
  context: string;
  action: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface Logger {
  info(action: string, message: string, metadata?: Record<string, unknown>): void;
  warn(action: string, message: string, metadata?: Record<string, unknown>): void;
  error(action: string, message: string, metadata?: Record<string, unknown>): void;
  debug(action: string, message: string, metadata?: Record<string, unknown>): void;
  child(overrides: Partial<Pick<LogEntry, "correlationId" | "context">>): Logger;
  setCorrelationId(correlationId: string): void;
}

export function createLogger(context: string, correlationId?: string): Logger {
  let currentCorrelationId = correlationId ?? "unset";

  function emit(
    level: LogLevel,
    action: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      level,
      correlationId: currentCorrelationId,
      context,
      action,
      message,
      timestamp: new Date().toISOString(),
    };

    if (metadata) {
      if (metadata.error instanceof Error) {
        entry.error = {
          name: metadata.error.name,
          message: metadata.error.message,
          stack: metadata.error.stack,
        };
        const { error: _err, ...rest } = metadata;
        if (Object.keys(rest).length > 0) {
          entry.metadata = rest;
        }
      } else {
        entry.metadata = metadata;
      }
    }

    const output = JSON.stringify(entry);
    if (level === "error") {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  }

  const logger: Logger = {
    info: (action, message, metadata) => emit("info", action, message, metadata),
    warn: (action, message, metadata) => emit("warn", action, message, metadata),
    error: (action, message, metadata) => emit("error", action, message, metadata),
    debug: (action, message, metadata) => emit("debug", action, message, metadata),

    child(overrides) {
      return createLogger(
        overrides.context ?? context,
        overrides.correlationId ?? currentCorrelationId,
      );
    },

    setCorrelationId(id: string) {
      currentCorrelationId = id;
    },
  };

  return logger;
}

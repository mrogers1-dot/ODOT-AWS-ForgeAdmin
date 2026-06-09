/**
 * Structured JSON logger for ForgeAdmin Lambdas.
 * Placeholder — full implementation in Wave 1, Task 1.6.
 */

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  correlationId: string;
  context: string;
  action: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function createLogger(_context: string): {
  info: (action: string, message: string, metadata?: Record<string, unknown>) => void;
  warn: (action: string, message: string, metadata?: Record<string, unknown>) => void;
  error: (action: string, message: string, metadata?: Record<string, unknown>) => void;
  debug: (action: string, message: string, metadata?: Record<string, unknown>) => void;
} {
  // Placeholder — will be implemented in Wave 1
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

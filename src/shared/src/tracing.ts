/**
 * X-Ray tracing initialization helper for ForgeAdmin Lambdas.
 *
 * Provides a lightweight wrapper around AWS X-Ray SDK.
 * Each Lambda calls initTracing() at module load time.
 */

export interface TracingConfig {
  serviceName: string;
  captureAWS?: boolean;
  captureHTTP?: boolean;
  annotations?: Record<string, string | number | boolean>;
}

export interface TracingContext {
  addAnnotation(key: string, value: string | number | boolean): void;
  addMetadata(key: string, value: unknown, namespace?: string): void;
  startSubsegment(name: string): SubsegmentHandle;
}

export interface SubsegmentHandle {
  close(): void;
  addError(error: Error): void;
}

export function initTracing(_config: TracingConfig): TracingContext {
  // No-op implementation for local/test. X-Ray SDK wired in Lambda runtime.
  const context: TracingContext = {
    addAnnotation(_key, _value) {},
    addMetadata(_key, _value, _namespace) {},
    startSubsegment(_name) {
      return {
        close() {},
        addError(_error) {},
      };
    },
  };
  return context;
}

export async function traceAsync<T>(
  tracing: TracingContext,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const subsegment = tracing.startSubsegment(name);
  try {
    const result = await fn();
    subsegment.close();
    return result;
  } catch (error) {
    if (error instanceof Error) {
      subsegment.addError(error);
    }
    subsegment.close();
    throw error;
  }
}

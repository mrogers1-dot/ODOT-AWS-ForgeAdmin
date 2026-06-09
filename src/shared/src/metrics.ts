/**
 * CloudWatch custom metrics helper using Embedded Metric Format (EMF).
 *
 * Metrics are emitted via structured log output — no API calls needed.
 */

import type { MetricDimensions } from "./types";

const NAMESPACE = "ForgeAdmin";

export interface MetricUnit {
  readonly value: string;
}

export const MetricUnits = {
  Count: { value: "Count" } as MetricUnit,
  Milliseconds: { value: "Milliseconds" } as MetricUnit,
  Seconds: { value: "Seconds" } as MetricUnit,
  Bytes: { value: "Bytes" } as MetricUnit,
  Percent: { value: "Percent" } as MetricUnit,
  None: { value: "None" } as MetricUnit,
} as const;

interface MetricEntry {
  name: string;
  value: number;
  unit: MetricUnit;
}

export interface MetricsRecorder {
  record(metricName: string, value: number, unit: MetricUnit): void;
  increment(metricName: string): void;
  recordDuration(metricName: string, durationMs: number): void;
  flush(): void;
}

export function createMetrics(
  context: string,
  additionalDimensions?: MetricDimensions,
): MetricsRecorder {
  const buffer: MetricEntry[] = [];

  const dimensions: MetricDimensions = {
    Context: context,
    ...additionalDimensions,
  };

  const recorder: MetricsRecorder = {
    record(metricName: string, value: number, unit: MetricUnit): void {
      buffer.push({ name: metricName, value, unit });
    },

    increment(metricName: string): void {
      buffer.push({ name: metricName, value: 1, unit: MetricUnits.Count });
    },

    recordDuration(metricName: string, durationMs: number): void {
      buffer.push({ name: metricName, value: durationMs, unit: MetricUnits.Milliseconds });
    },

    flush(): void {
      if (buffer.length === 0) return;

      const dimensionNames = Object.keys(dimensions);
      const metricDefinitions = buffer.map((m) => ({
        Name: m.name,
        Unit: m.unit.value,
      }));

      const emfLog: Record<string, unknown> = {
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [
            {
              Namespace: NAMESPACE,
              Dimensions: [dimensionNames],
              Metrics: metricDefinitions,
            },
          ],
        },
        ...dimensions,
      };

      for (const metric of buffer) {
        emfLog[metric.name] = metric.value;
      }

      process.stdout.write(JSON.stringify(emfLog) + "\n");
      buffer.length = 0;
    },
  };

  return recorder;
}

export async function withTiming<T>(
  metrics: MetricsRecorder,
  metricName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metrics.recordDuration(metricName, Date.now() - start);
    return result;
  } catch (error) {
    metrics.recordDuration(metricName, Date.now() - start);
    metrics.increment(`${metricName}.Error`);
    throw error;
  }
}

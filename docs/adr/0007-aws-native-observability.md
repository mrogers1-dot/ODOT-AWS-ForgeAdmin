# ADR-0007: AWS-Native Observability Stack

## Status

Accepted

## Context

ForgeAdmin needs comprehensive observability for:

- Distributed tracing across multi-agent workflows
- Structured logging with correlation IDs
- Custom metrics for SLA monitoring and performance
- Alerting on anomalies (DLQ depth, error rates, latency)

Options considered:

1. **AWS-native** (CloudWatch, X-Ray, CloudWatch Metrics) — zero additional infrastructure
2. **Third-party** (Datadog, New Relic) — better UX but adds cost and vendor dependency
3. **Open-source** (Grafana + Prometheus + Jaeger) — requires self-managed infrastructure

## Decision

We use the AWS-native observability stack:

1. **CloudWatch Logs** — Structured JSON logging from all Lambdas
2. **X-Ray** — Distributed tracing with segment/subsegment correlation
3. **CloudWatch Metrics** — Custom metrics (invocation count, error count, duration percentiles)
4. **CloudWatch Dashboards** — Per-context and platform-wide overview dashboards
5. **CloudWatch Alarms + SNS** — Automated alerting for threshold breaches

Shared utilities (`src/shared/`) provide consistent instrumentation across all Lambdas.

## Consequences

### Positive

- Zero additional infrastructure — leverages existing AWS services
- X-Ray integrates natively with Lambda, API Gateway, Step Functions
- CloudWatch Insights enables ad-hoc log querying with correlation
- No additional vendor contracts or data egress costs

### Negative

- CloudWatch Dashboards have limited visualization compared to Grafana
- X-Ray sampling rate may miss low-frequency issues (configurable)
- CloudWatch Metrics has 5-minute default resolution (1-minute available at extra cost)

### Neutral

- All metrics and logs remain within the AWS account boundary
- Can be augmented with third-party tools later without changing instrumentation code

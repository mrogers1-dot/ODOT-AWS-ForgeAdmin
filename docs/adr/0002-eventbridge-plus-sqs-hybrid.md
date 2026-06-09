# ADR-0002: EventBridge + SQS Hybrid Event Transport

## Status

Accepted

## Context

We need a reliable event transport mechanism that supports:

- Fan-out to multiple consumers per event type
- Dead-letter queues for failed processing
- Event filtering to avoid unnecessary Lambda invocations
- Schema validation at the bus level
- At-least-once delivery guarantees

Pure SQS would require explicit fan-out management. Pure SNS lacks built-in filtering and DLQ support at the topic level. EventBridge provides native filtering, schema registry, and archive/replay but benefits from SQS buffering for high-throughput or retry-heavy consumers.

## Decision

We use Amazon EventBridge as the primary event bus with SQS queues as targets where buffering or retry isolation is needed:

1. **EventBridge custom bus** (`forgeadmin-events`) — all cross-context events flow here
2. **EventBridge rules** — filter events by `detail-type` and route to appropriate targets
3. **SQS queues** — used as intermediate buffers for consumers that need retry isolation or batch processing
4. **DLQ per consumer** — every SQS queue has an associated DLQ with active monitoring

## Consequences

### Positive

- Native content-based filtering reduces unnecessary invocations
- Schema Registry provides contract documentation and validation
- Archive/Replay enables debugging and reprocessing
- SQS provides backpressure and retry isolation per consumer

### Negative

- Two messaging services to configure and monitor
- EventBridge has a 256KB event size limit
- Slight latency overhead vs direct Lambda invocation (~50-100ms)

### Neutral

- Cost is usage-based for both services — acceptable at POC scale
- Team needs familiarity with both EventBridge rules and SQS configurations

# ADR-0004: DynamoDB + S3 Tiered Storage

## Status

Accepted

## Context

ForgeAdmin needs to store operational data (work items, execution plans, audit entries) with:

- Fast reads for active items (< 90 days old)
- Long-term retention for compliance and learning
- Cost-effective archival — hot data is small, cold data accumulates
- Zero data loss during lifecycle transitions

DynamoDB provides excellent performance for active data but becomes expensive for large volumes of cold data. S3 provides cheap long-term storage with lifecycle policies.

## Decision

We implement a two-tier storage architecture:

1. **DynamoDB** — Active data store with 90-day TTL on most item types
2. **DynamoDB Streams** — Triggers archival Lambda before TTL deletion
3. **S3** — Cold storage with lifecycle policies (Standard → IA after 90 days, Glacier after 1 year)
4. **Single-table design** — Each DynamoDB table uses composite keys and GSIs to support multiple access patterns

Data flow: Active items live in DynamoDB → DynamoDB Streams captures TTL deletions → Archival Lambda writes to S3 → S3 lifecycle manages tiering.

## Consequences

### Positive

- Sub-millisecond reads for active operational data
- Effectively unlimited cold storage at minimal cost
- Zero data loss — Stream-based archival captures items before deletion
- S3 lifecycle automation requires no operational overhead

### Negative

- Query patterns must be designed upfront (DynamoDB single-table)
- Archived data requires S3 Select or Athena for ad-hoc queries
- DynamoDB Streams adds Lambda invocation costs (minimal at POC scale)

### Neutral

- 90-day TTL is configurable per item type
- `force_destroy = true` on all tables for POC teardown capability
- PITR enabled on critical tables for point-in-time recovery

# ForgeAdmin Implementation Tasks

## Status: ✅ ALL WAVES COMPLETE

All 10 waves executed successfully via RED/GREEN/REFACTOR TDD.

| Metric | Value |
|--------|-------|
| Total tests | 285 |
| Test files | 51 |
| Terraform modules | 9 |
| Event schemas | 26 |
| Property tests | 12 |
| Integration tests | 6 |

## Overview

Implementation is organized into 16 logical task groups, each corresponding to a bounded context or cross-cutting concern. Groups are executed in dependency order with parallelism within waves. All tasks follow the **Red/Green/Refactor** cycle for disciplined TDD.

## Task Group Index

| # | Group | Context | Pattern | Tasks |
|---|-------|---------|---------|-------|
| 01 | [Platform Foundation](./01-platform-foundation.md) | Platform/Infra | Terraform | 6 |
| 02 | [Contracts & Documentation](./02-contracts-documentation.md) | Cross-cutting | Schemas/Docs | 4 |
| 03 | [Ingestion](./03-ingestion.md) | Ingestion | Simple Lambda | 6 |
| 04 | [Agent Orchestration](./04-orchestration.md) | Orchestration | Hexagonal | 11 |
| 05 | [Knowledge Base](./05-knowledge-base.md) | Knowledge Base | Simple Lambda | 4 |
| 06 | [Execution Layer](./06-execution.md) | Execution | Hexagonal | 5 |
| 07 | [Dashboard & API](./07-dashboard.md) | Dashboard | React + Lambda | 6 |
| 08 | [Communication](./08-communication.md) | Communication | Simple Lambda | 4 |
| 09 | [Platform Services](./09-platform-services.md) | Platform/Infra | Simple Lambda | 6 |
| 10 | [Integration & Reliability](./10-integration-reliability.md) | Cross-cutting | Integration | 3 |
| 11 | [Skills & Steering](./11-skills-steering.md) | Cross-cutting | Simple Lambda | 7 |
| 12 | [Incident Correlation](./12-incident-correlation.md) | Correlation | Hexagonal | 13 |
| 13 | [Feedback Loop](./13-feedback-loop.md) | KB + Orchestration | Simple Lambda | 11 |
| 14 | [Dry-Run Simulation](./14-dry-run-simulation.md) | Execution + Dashboard | Hexagonal | 13 |
| 15 | [Confidence Calibration](./15-confidence-calibration.md) | Orchestration + Dashboard | React + Lambda | 10 |
| 16 | [Playbook Composition](./16-playbook-composition.md) | KB + Orchestration + Execution | Simple Lambda | 15 |

**Total: ~129 tasks across 16 groups**

## Key Changes from Alignment Review

The following additions were made based on a 13-finding alignment review:

1. **Sensitive data escalation** — Human escalation path for data that can't be redacted without losing resolution context (no on-prem LLM for POC)
2. **Notification escalation architecture** — Three-tier: Teams/Slack → SES email → Dashboard alert (`notification.failed` event)
3. **NL command authorization** — Identity mapping (Teams/Slack user ID → Cognito role) with full RBAC enforcement
4. **Token budget API** — `GET /agents/:name/token-budget` endpoint + Dashboard indicator showing per-agent context window consumption
5. **DynamoDB → S3 archival** — DynamoDB Streams trigger archiving items to S3 before TTL deletion (zero data loss)
6. **DLQ monitoring** — Active alerting on failed messages with reprocessing for ingestion context
7. **WebSocket resilience** — Heartbeat (30s), automatic reconnection with exponential backoff, staleness indicator
8. **POC satisfaction survey** — Dashboard form collecting structured feedback from team members
9. **Race condition integration test** — Validates plan.rejected arriving between dispatch and execution halts correctly
10. **Shadow mode + Skills/Steering intersection** — Confirms shadow processing includes prompt composition

## Execution Order (Dependency Waves)

```
Wave 0:  Monorepo setup, ADRs/README
Wave 1:  Terraform foundation, shared utilities, event schemas
Wave 2:  Platform context Terraform, deploy scripts, OpenAPI, contract validation
Wave 3:  CI/CD + all context Terraform modules (parallel)
Wave 4:  Ports/models for hexagonal contexts, normalizer/dedup
Wave 5:  Agent logic (Triage, Research, Planning, Verification), redaction module,
         execution orchestrator, Lambda handlers (parallel across contexts)
Wave 6:  Property tests, adapters, KB handlers, Supervisor Agent wiring
Wave 7:  Thin handlers, Documentation Agent, unit tests, platform services
         (audit, archival, circuit breaker, degradation, DLQ monitor),
         Skills/Steering infra + schemas
Wave 8:  Dashboard API (with token budget), module state management, WebSocket,
         notification dispatcher (with escalation), morning digest,
         identity mapping, NL command handler, circuit breaker property tests,
         Skills/Steering API + prompt composition
Wave 9:  Property tests (state machine), React frontend (with WebSocket resilience +
         token budget), communication consolidation, shadow mode,
         Skills/Steering integration + UI, notification handling for skills
Wave 10: Integration tests, POC validation suite, POC survey, Skills/Steering
         consolidation
```

## Checkpoints

| Checkpoint | After | Validates | Status |
|-----------|-------|-----------|--------|
| Foundation | Wave 2 | `terraform validate`, `npm run typecheck` | ✅ |
| Core Pipeline | Wave 6 | All unit tests pass, ingestion + orchestration validated | ✅ |
| Full Platform | Wave 8 | All modules validate, all unit tests pass | ✅ |
| Final | Wave 10 | Integration tests, POC validation scripts, all green | ✅ |

## Destroy/Rebuild Independence

Each bounded context deploys and destroys independently:
- `terraform/scripts/destroy-context.sh {context-name}` — single context teardown
- `terraform/scripts/destroy-all.sh` — full account wipe (contexts first, foundation last)
- `terraform/scripts/deploy-all.sh` — full rebuild (foundation first, contexts parallel)

## Architecture Patterns

| Context | Pattern | Reason |
|---------|---------|--------|
| Orchestration | Hexagonal | Complex domain logic with many external dependencies |
| Execution | Hexagonal | Bridge pattern to on-prem; multiple adapters |
| Correlation | Hexagonal | Rule engine with ports for storage, history, enrichment |
| Ingestion | Simple Lambda | Straightforward ETL with minimal domain logic |
| Knowledge Base | Simple Lambda | Thin handlers around Bedrock KB |
| Dashboard | React SPA + Lambda | User-facing with real-time WebSocket updates |
| Communication | Simple Lambda | Event-driven notification routing |
| Platform | Terraform + Lambda | Infrastructure + cross-cutting services |

## Notes

- All Terraform uses `force_destroy = true` for POC teardown capability
- Contexts communicate exclusively via EventBridge events (no direct Lambda-to-Lambda)
- RBAC: `team_lead` (full access) and `team_member` (read-only config, can approve)
- Property-based tests validate 12 formal correctness properties
- 90-day DynamoDB TTL with Streams-based archival to S3 ensures data lifecycle compliance
- Three-tier notification escalation ensures critical alerts are never missed
- NL commands in Teams/Slack are fully authorized via identity mapping

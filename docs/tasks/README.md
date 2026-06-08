# ForgeAdmin Implementation Tasks

## Overview

Implementation is organized into 10 logical task groups, each corresponding to a bounded context or cross-cutting concern. Groups are executed in dependency order with parallelism within waves.

## Task Group Index

| # | Group | Context | Pattern | Tasks |
|---|-------|---------|---------|-------|
| 01 | [Platform Foundation](./01-platform-foundation.md) | Platform/Infra | Terraform | 6 |
| 02 | [Contracts & Documentation](./02-contracts-documentation.md) | Cross-cutting | Schemas/Docs | 4 |
| 03 | [Ingestion](./03-ingestion.md) | Ingestion | Simple Lambda | 7 |
| 04 | [Agent Orchestration](./04-orchestration.md) | Orchestration | Hexagonal | 12 |
| 05 | [Knowledge Base](./05-knowledge-base.md) | Knowledge Base | Simple Lambda | 5 |
| 06 | [Execution Layer](./06-execution.md) | Execution | Hexagonal | 6 |
| 07 | [Dashboard & API](./07-dashboard.md) | Dashboard | React + Lambda | 7 |
| 08 | [Communication](./08-communication.md) | Communication | Simple Lambda | 5 |
| 09 | [Platform Services](./09-platform-services.md) | Platform/Infra | Simple Lambda | 7 |
| 10 | [Integration & Reliability](./10-integration-reliability.md) | Cross-cutting | Integration | 3 |

**Total: 62 tasks across 10 groups**

## Execution Order

```
Wave 0:  Monorepo setup, ADRs/README
Wave 1:  Terraform foundation, shared utilities, event schemas
Wave 2:  Platform context Terraform, deploy scripts, OpenAPI, contract validation
Wave 3:  CI/CD + all context Terraform modules (parallel)
Wave 4:  Ports/models for hexagonal contexts, normalizer/dedup
Wave 5:  Agent logic, Lambda handlers (parallel across contexts)
Wave 6:  Property tests, adapters, KB handlers
Wave 7:  Wiring layers, unit tests, platform services
Wave 8:  Dashboard API, communication handlers, property tests
Wave 9:  Frontend, integration middleware, remaining tests
Wave 10: End-to-end integration tests
```

## Destroy/Rebuild Independence

Each bounded context deploys and destroys independently:
- `terraform/scripts/destroy-context.sh {context-name}` — single context teardown
- `terraform/scripts/destroy-all.sh` — full account wipe (contexts first, foundation last)
- `terraform/scripts/deploy-all.sh` — full rebuild (foundation first, contexts parallel)

## Notes

- Tasks marked `*` are optional (property tests, unit tests) for faster MVP
- Checkpoints gate progress at major milestones
- Property-based tests validate 6 formal correctness properties
- All Terraform uses `force_destroy = true` for POC teardown

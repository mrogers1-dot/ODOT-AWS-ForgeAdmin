# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for ForgeAdmin. ADRs document significant architectural choices and their rationale.

## Index

| # | Decision | Status | Key Context |
|---|----------|--------|-------------|
| [0001](./0001-event-driven-microservices.md) | Event-Driven Microservices Architecture | Accepted | Coordination across bounded contexts via async events |
| [0002](./0002-eventbridge-plus-sqs-hybrid.md) | EventBridge + SQS Hybrid Event Transport | Accepted | Reliable pub/sub with dead-letter queues and fan-out |
| [0003](./0003-hexagonal-for-complex-contexts.md) | Hexagonal Architecture for Complex Contexts | Accepted | Ports/adapters for Orchestration, Execution, Correlation |
| [0004](./0004-dynamodb-plus-s3-tiered-storage.md) | DynamoDB + S3 Tiered Storage | Accepted | Hot data in DynamoDB, 90-day TTL with S3 archival |
| [0005](./0005-terraform-independent-state-per-context.md) | Terraform Independent State Per Context | Accepted | Each context has its own Terraform state for isolation |
| [0006](./0006-react-spa-serverless-dashboard.md) | React SPA + Serverless Dashboard | Accepted | CloudFront-hosted React with Lambda API + WebSocket |
| [0007](./0007-aws-native-observability.md) | AWS-Native Observability Stack | Accepted | CloudWatch, X-Ray, structured logging, metrics |
| [0008](./0008-json-schema-openapi-contracts.md) | JSON Schema + OpenAPI Contracts | Accepted | Formal event schemas + OpenAPI 3.1 for Dashboard API |

## Template

Use [template.md](./template.md) when creating new ADRs.

## Conventions

- ADRs are numbered sequentially (0001, 0002, ...)
- Status values: `Proposed`, `Accepted`, `Deprecated`, `Superseded`
- File naming: `{number}-{short-title}.md`
- All ADRs apply to the current 8-context architecture (Ingestion, Orchestration, Execution, Knowledge Base, Correlation, Dashboard, Communication, Platform)

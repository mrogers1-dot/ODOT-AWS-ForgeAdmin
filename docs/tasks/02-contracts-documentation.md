# Task Group 02: Event Contracts & Documentation

**Bounded Context:** Cross-cutting
**Dependencies:** Task Group 01 (directory structure exists)
**ADR Impact:** ADR-0008 (JSON Schema + OpenAPI contracts)

---

## Tasks

- [ ] 3.1 Define JSON Schema event contracts
  - Create `contracts/events/ingestion/work-item.created.schema.json`
  - Create `contracts/events/orchestration/triage.completed.schema.json`
  - Create `contracts/events/orchestration/plan.proposed.schema.json`
  - Create `contracts/events/orchestration/verification.completed.schema.json`
  - Create `contracts/events/orchestration/work-item.resolved.schema.json`
  - Create `contracts/events/dashboard/plan.approved.schema.json`
  - Create `contracts/events/dashboard/plan.rejected.schema.json`
  - Create `contracts/events/dashboard/module.state-changed.schema.json`
  - Create `contracts/events/dashboard/approval.decision.schema.json`
  - Create `contracts/events/execution/execution.completed.schema.json`
  - Create `contracts/events/execution/execution.failed.schema.json`
  - Create `contracts/events/knowledge-base/runbook.generated.schema.json`
  - Create `contracts/events/knowledge-base/kb.updated.schema.json`
  - Create `contracts/events/platform/circuit-breaker.tripped.schema.json`
  - Create `contracts/events/platform/audit.entry-created.schema.json`
  - Create `contracts/events/communication/notification.sent.schema.json`
  - All schemas must follow the EventEnvelope standard: source, detail-type, detail (version, correlationId, timestamp, payload)
  - _Requirements: 15.4_

- [ ] 3.2 Create OpenAPI 3.1 specification for Dashboard API
  - Create `contracts/api/openapi.yaml` defining all endpoints: GET/PATCH /modules, GET/POST /approvals, GET /executions, GET /audit, PATCH /modules/:id/config
  - Define request/response schemas, Cognito JWT security scheme, RBAC annotations
  - Include WebSocket API connection/subscription schemas
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 3.3 Create contract validation utilities
  - Create `src/shared/contract-validator.ts`: JSON Schema validation utility for event publishing
  - Create `scripts/validate-contracts.ts`: CI script that validates all event schemas are valid JSON Schema and all OpenAPI specs pass linting
  - Add contract validation step to GitHub Actions PR workflow
  - _Requirements: 15.4_

- [x] 3.4 Create ADR documents and project documentation
  - Create `docs/adr/template.md` with Status/Context/Decision/Consequences format
  - Create `docs/adr/0001-event-driven-microservices.md`
  - Create `docs/adr/0002-eventbridge-plus-sqs-hybrid.md`
  - Create `docs/adr/0003-hexagonal-for-complex-contexts.md`
  - Create `docs/adr/0004-dynamodb-plus-s3-tiered-storage.md`
  - Create `docs/adr/0005-terraform-independent-state-per-context.md`
  - Create `docs/adr/0006-react-spa-serverless-dashboard.md`
  - Create `docs/adr/0007-aws-native-observability.md`
  - Create `docs/adr/0008-json-schema-openapi-contracts.md`
  - Create `docs/README.md`: living project overview with architecture diagram, context map, getting started links
  - Create `docs/QUICKSTART.md`: prerequisites, AWS setup, deploy steps, first-run verification
  - Create `docs/architecture/context-map.md`: visual map of all 7 bounded contexts and their event flows
  - _Requirements: 15.1, 15.4_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 3.4 | 0 |
| 3.1 | 1 |
| 3.2, 3.3 | 2 |

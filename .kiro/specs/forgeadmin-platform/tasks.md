# Implementation Plan: ForgeAdmin Platform

## Overview

This plan implements the ForgeAdmin agentic multi-agent platform across 7 bounded contexts, following the architecture design's recommended build order: Platform/Infra foundation first, then Ingestion, Agent Orchestration, Knowledge Base, Execution Layer, Dashboard & API, and Communication. Each context deploys independently with its own Terraform state. TypeScript is used throughout for Lambda handlers and domain logic; React (TypeScript, Vite) for the dashboard frontend.

All implementation tasks follow the **Red/Green/Refactor** cycle:
- **RED**: Write a failing test that defines the expected behavior
- **GREEN**: Write the minimal code to make the test pass
- **REFACTOR**: Improve code quality while keeping tests green

## Task Group Files

Detailed tasks are split by bounded context in `docs/tasks/`:

| # | Group | File |
|---|-------|------|
| 01 | Platform Foundation | [01-platform-foundation.md](../../../docs/tasks/01-platform-foundation.md) |
| 02 | Contracts & Documentation | [02-contracts-documentation.md](../../../docs/tasks/02-contracts-documentation.md) |
| 03 | Ingestion | [03-ingestion.md](../../../docs/tasks/03-ingestion.md) |
| 04 | Agent Orchestration | [04-orchestration.md](../../../docs/tasks/04-orchestration.md) |
| 05 | Knowledge Base | [05-knowledge-base.md](../../../docs/tasks/05-knowledge-base.md) |
| 06 | Execution Layer | [06-execution.md](../../../docs/tasks/06-execution.md) |
| 07 | Dashboard & API | [07-dashboard.md](../../../docs/tasks/07-dashboard.md) |
| 08 | Communication | [08-communication.md](../../../docs/tasks/08-communication.md) |
| 09 | Platform Services | [09-platform-services.md](../../../docs/tasks/09-platform-services.md) |
| 10 | Integration & Reliability | [10-integration-reliability.md](../../../docs/tasks/10-integration-reliability.md) |
| 11 | Skills & Steering | [11-skills-steering.md](../../../docs/tasks/11-skills-steering.md) |
| 12 | Incident Correlation | [12-incident-correlation.md](../../../docs/tasks/12-incident-correlation.md) |
| 13 | Feedback Loop | [13-feedback-loop.md](../../../docs/tasks/13-feedback-loop.md) |
| 14 | Dry Run Simulation | [14-dry-run-simulation.md](../../../docs/tasks/14-dry-run-simulation.md) |
| 15 | Confidence Calibration | [15-confidence-calibration.md](../../../docs/tasks/15-confidence-calibration.md) |
| 16 | Playbook Composition | [16-playbook-composition.md](../../../docs/tasks/16-playbook-composition.md) |

## Tasks

- [x] 1. Platform Foundation & Shared Infrastructure
  - [x] 1.1 Create monorepo directory structure and project configuration
    - **RED**: Write a test that asserts the expected directory structure exists and `tsconfig.json` compiles with strict mode
    - **GREEN**: Create top-level directory structure: `terraform/foundation/`, `terraform/contexts/{ingestion,orchestration,execution,knowledge-base,dashboard,communication,platform}/`, `terraform/scripts/`, `terraform/environments/`, `contracts/events/`, `contracts/api/`, `docs/adr/`, `src/shared/`. Initialize root `package.json` with TypeScript, Vitest, ESLint, fast-check dependencies. Create `tsconfig.json` with strict mode and path aliases. Create `.eslintrc.json` enforcing structured logging and consistent patterns.
    - **REFACTOR**: Validate all path aliases resolve correctly; ensure ESLint rules pass on empty project
    - _Requirements: 15.1, 15.4_

  - [x] 1.2 Create Terraform foundation module — EventBridge, networking, IAM
    - **RED**: Write a `terraform validate` check that expects the foundation module to validate cleanly
    - **GREEN**: Create `terraform/foundation/main.tf` with AWS provider configuration. Create `terraform/foundation/eventbridge.tf`: custom event bus `forgeadmin-events`, Schema Registry. Create `terraform/foundation/networking.tf`: VPC, Transit Gateway attachments, security groups. Create `terraform/foundation/iam-shared.tf`: cross-context IAM roles, least-privilege policies. Create `terraform/foundation/cognito.tf`: User Pool with `team_lead` and `team_member` roles. Create `terraform/foundation/outputs.tf`: SSM parameters for EventBridge bus ARN, VPC ID, Cognito pool ID. Create `terraform/foundation/backend.tf`: S3 backend with key `forgeadmin/foundation/terraform.tfstate`. Create `terraform/foundation/variables.tf` and `terraform/environments/dev.tfvars`.
    - **REFACTOR**: Extract repeated provider/backend patterns into shared locals; validate variable descriptions are complete
    - _Requirements: 15.1, 15.2, 13.3_

  - [x] 1.3 Create Terraform platform context — observability, audit trail, circuit breaker
    - **RED**: Write a `terraform validate` check for the platform context module
    - **GREEN**: Create `terraform/contexts/platform/main.tf` with S3 backend key `forgeadmin/platform/terraform.tfstate`. Create `terraform/contexts/platform/dynamodb.tf`: audit trail table (single-table design with GSIs: `actor-timestamp-index`, `context-action-index`), DynamoDB Streams enabled, `force_destroy = true`. Create `terraform/contexts/platform/s3.tf`: storage bucket with lifecycle policies (90-day transition, Glacier after 1yr), `force_destroy = true`, versioning enabled. Create `terraform/contexts/platform/cloudwatch.tf`: dashboards (per-context + platform overview), alarms for DLQ depth (threshold > 0), error rate thresholds. Create `terraform/contexts/platform/sns.tf`: alarm notification topics. Create `terraform/contexts/platform/lambda.tf`: DLQ monitor Lambda, archival Lambda (DynamoDB Streams trigger). SSM parameter lookups for foundation outputs.
    - **REFACTOR**: Ensure all resources use consistent naming conventions; validate lifecycle policies are correct; verify DynamoDB Streams are configured for OLD_IMAGE
    - _Requirements: 13.1, 13.4, 13.5, 14.4, 9.1, 9.2_

  - [x] 1.4 Create deployment scripts (deploy-all, destroy-all, destroy-context)
    - **RED**: Write a shellcheck/lint test that validates script syntax and error handling patterns
    - **GREEN**: Create `terraform/scripts/deploy-all.sh`: deploys foundation first, then all contexts in parallel. Create `terraform/scripts/destroy-all.sh`: destroys all contexts in parallel, then foundation last. Create `terraform/scripts/destroy-context.sh`: accepts context name argument, destroys single context. All scripts must validate prerequisites (AWS CLI, Terraform installed) and handle errors.
    - **REFACTOR**: Add usage documentation in script headers; ensure consistent exit code handling
    - _Requirements: 15.1_

  - [x] 1.5 Create GitHub Actions CI/CD pipeline
    - **RED**: Write a workflow lint/validation check (actionlint) for the GitHub Actions YAML
    - **GREEN**: Create `.github/workflows/terraform-deploy.yml`: triggered on merge to main. Implement plan → validate → apply stages with 15-minute timeout. Add manual approval gate for resource destruction/replacement. Implement automatic rollback on failure (revert to last successful commit, re-apply). Add Terraform fmt/validate checks on PR. Create `.github/workflows/pr-checks.yml`: lint, typecheck, unit tests, contract validation.
    - **REFACTOR**: Extract reusable composite actions; ensure secrets are referenced not hardcoded
    - _Requirements: 15.3, 15.5, 15.6_

  - [x] 1.6 Implement shared observability utilities
    - **RED**: Write tests asserting logger outputs valid JSON with required fields (`correlationId`, `context`, `action`, `level`); test metrics helper emits correct CloudWatch format
    - **GREEN**: Create `src/shared/logging.ts`: structured JSON logger with `correlationId`, `context`, `action`, `level` fields. Create `src/shared/tracing.ts`: X-Ray tracing initialization helper for Lambdas. Create `src/shared/metrics.ts`: CloudWatch custom metrics helper (invocation count, error count, duration percentiles). Create `src/shared/types.ts`: shared TypeScript types (EventEnvelope, CorrelationContext).
    - **REFACTOR**: Ensure logger is tree-shakeable; validate type exports are minimal and well-documented
    - _Requirements: 13.1, 14.5_

- [x] 2. Checkpoint — Foundation validation
  - Run `terraform validate` in each module. Run `npm run typecheck`. Ask the user if questions arise.

- [x] 3. Event Contracts & Documentation
  - [x] 3.1 Define JSON Schema event contracts
    - **RED**: Write a contract validation test that loads each schema and asserts it is valid JSON Schema Draft 2020-12
    - **GREEN**: Create the following schemas in `contracts/events/`:
      - `ingestion/work-item.created.schema.json`
      - `orchestration/triage.completed.schema.json`
      - `orchestration/plan.proposed.schema.json`
      - `orchestration/verification.completed.schema.json`
      - `orchestration/work-item.resolved.schema.json`
      - `dashboard/plan.approved.schema.json`
      - `dashboard/plan.rejected.schema.json`
      - `dashboard/module.state-changed.schema.json`
      - `dashboard/approval.decision.schema.json`
      - `communication/approval.decision.schema.json` (same schema, different source)
      - `execution/execution.completed.schema.json`
      - `execution/execution.failed.schema.json`
      - `knowledge-base/runbook.generated.schema.json`
      - `knowledge-base/kb.updated.schema.json`
      - `platform/circuit-breaker.tripped.schema.json`
      - `platform/audit.entry-created.schema.json`
      - `platform/dlq.message-received.schema.json`
      - `communication/notification.sent.schema.json`
      - `communication/notification.failed.schema.json`
      - `dashboard/skill.updated.schema.json`
      - `dashboard/steering.updated.schema.json`
      - All schemas follow the EventEnvelope standard: source, detail-type, detail (version, correlationId, timestamp, payload)
    - **REFACTOR**: Extract shared `$defs` for EventEnvelope, CorrelationContext into a common schema file referenced by `$ref`
    - _Requirements: 15.4_

  - [x] 3.2 Create OpenAPI 3.1 specification for Dashboard API
    - **RED**: Write an OpenAPI lint test (spectral) that validates the spec has no errors
    - **GREEN**: Create `contracts/api/openapi.yaml` defining all endpoints: GET/PATCH /modules, GET/POST /approvals, GET /executions, GET /audit, PATCH /modules/:id/config, CRUD /skills, CRUD /steering (with versioning and rollback), GET /agents/:name/token-budget. Define request/response schemas including `ModuleConfig` (confidenceThreshold 0-100, promotionStrategy manual|auto-suggest, evaluationWindow 7-90, slaPeriod 5-1440), `TokenBudgetResponse`, Cognito JWT security scheme, RBAC annotations for `team_lead` and `team_member` roles. Include WebSocket API connection/subscription schemas.
    - **REFACTOR**: Ensure all response schemas reference shared components; add example values; validate ModuleConfig constraints are documented in schema
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 13.3, 17.1, 17.2, 17.9_

  - [x] 3.3 Create contract validation utilities
    - **RED**: Write a test that validates a sample event against its schema and rejects an invalid event
    - **GREEN**: Create `src/shared/contract-validator.ts`: JSON Schema validation utility for event publishing. Create `scripts/validate-contracts.ts`: CI script that validates all event schemas are valid JSON Schema and all OpenAPI specs pass linting. Add contract validation step to GitHub Actions PR workflow.
    - **REFACTOR**: Ensure validator provides clear error messages with JSON path to failing field
    - _Requirements: 15.4_

  - [x] 3.4 Create ADR documents and project documentation
    - **RED**: Write a documentation structure test asserting all expected ADR files exist and contain required sections (Status/Context/Decision/Consequences)
    - **GREEN**: Create `docs/adr/template.md` with Status/Context/Decision/Consequences format. Create ADRs: `0001-event-driven-microservices.md`, `0002-eventbridge-plus-sqs-hybrid.md`, `0003-hexagonal-for-complex-contexts.md`, `0004-dynamodb-plus-s3-tiered-storage.md`, `0005-terraform-independent-state-per-context.md`, `0006-react-spa-serverless-dashboard.md`, `0007-aws-native-observability.md`, `0008-json-schema-openapi-contracts.md`, `0009-skills-steering-prompt-injection.md`, `0010-sensitive-data-human-escalation.md` (documents that on-prem LLM routing is deferred; sensitive data requiring full context is escalated to human operators). Create `docs/README.md`: living project overview with architecture diagram, context map, getting started links. Create `docs/QUICKSTART.md`: prerequisites, AWS setup, deploy steps, first-run verification. Create `docs/architecture/context-map.md`: visual map of all 7 bounded contexts and their event flows.
    - **REFACTOR**: Ensure all internal links resolve; validate markdown formatting
    - _Requirements: 15.1, 15.4, 13.2_


- [x] 4. Ingestion Context
  - [x] 4.1 Create Ingestion Terraform module
    - **RED**: Write a `terraform validate` check for the ingestion context module
    - **GREEN**: Create `terraform/contexts/ingestion/main.tf` with S3 backend key `forgeadmin/ingestion/terraform.tfstate`. Create `terraform/contexts/ingestion/dynamodb.tf`: work items table with GSI `sourceSystem-originalId-index` for deduplication, DynamoDB Streams enabled (for archival), `force_destroy = true`, on-demand capacity, PITR enabled. Create `terraform/contexts/ingestion/lambda.tf`: three Lambda functions (ServiceNow poller, SES handler, FortiSIEM webhook), EventBridge rule for scheduled polling. Create `terraform/contexts/ingestion/api-gateway.tf`: FortiSIEM webhook endpoint. Create `terraform/contexts/ingestion/ses.tf`: SES receipt rule for `servers@dot.ohio.gov`. Create `terraform/contexts/ingestion/sqs.tf`: ingestion DLQ for failed processing. Create `terraform/contexts/ingestion/iam.tf`: per-Lambda IAM roles with least-privilege. SSM lookups for EventBridge bus ARN.
    - **REFACTOR**: Extract Lambda resource patterns into local module; validate IAM policies are minimal
    - _Requirements: 1.1, 1.2, 1.3, 15.1, 15.2_

  - [x] 4.2 Implement WorkItem normalizer and deduplication checker
    - **RED**: Write tests: (1) normalizer transforms a ServiceNow payload into correct WorkItem format, (2) normalizer transforms an email payload into correct WorkItem format, (3) normalizer transforms a FortiSIEM payload into correct WorkItem format, (4) deduplication returns true for existing item, false for new item
    - **GREEN**: Create `src/contexts/ingestion/normalizer.ts`: transforms ServiceNow, email, FortiSIEM payloads into common `WorkItem` interface. Create `src/contexts/ingestion/deduplication.ts`: DynamoDB lookup by `sourceSystem + originalId`, skip if exists, log duplicate detection. Create `src/contexts/ingestion/models.ts`: TypeScript interfaces for WorkItem, source-specific payloads.
    - **REFACTOR**: Extract common field mapping logic; ensure all source-specific fields are preserved in metadata
    - _Requirements: 1.4, 1.7_

  - [x] 4.3 Implement ServiceNow poller Lambda
    - **RED**: Write tests: (1) successful poll creates work items and publishes events, (2) poll with no new items does nothing, (3) source unavailable triggers exponential backoff, (4) 3 consecutive failures triggers Teams/Slack notification
    - **GREEN**: Create `src/contexts/ingestion/handlers/servicenow-poller.ts`: scheduled Lambda polling ServiceNow API. Implement polling logic with last-checked timestamp tracking. Integrate normalizer, deduplication checker, and EventBridge publishing (`work-item.created`). Implement error handling: exponential backoff on failure, Teams/Slack notification after 3 consecutive failures. Apply structured logging with correlationId and X-Ray tracing.
    - **REFACTOR**: Extract retry/backoff logic into shared utility; ensure timestamp tracking is atomic
    - _Requirements: 1.1, 1.5_

  - [x] 4.4 Implement SES email handler Lambda
    - **RED**: Write tests: (1) valid email creates work item with all fields, (2) email with missing subject still creates work item flagged for manual review, (3) empty body email creates work item flagged for manual review and notifies Teams/Slack, (4) duplicate email is skipped
    - **GREEN**: Create `src/contexts/ingestion/handlers/ses-handler.ts`: triggered by SES receipt rule. Parse email extracting: sender address, subject line, received timestamp, body content. Handle unparseable emails: create work item with available fields, flag for manual review, notify Teams/Slack. Integrate normalizer, deduplication, EventBridge publishing.
    - **REFACTOR**: Extract email parsing into separate testable module; validate edge cases for multipart emails
    - _Requirements: 1.2, 1.6_

  - [x] 4.5 Implement FortiSIEM webhook Lambda
    - **RED**: Write tests: (1) valid webhook creates work item and publishes event, (2) invalid payload returns 400, (3) retry with exponential backoff on transient failure, (4) backoff caps at 5 minutes
    - **GREEN**: Create `src/contexts/ingestion/handlers/fortisiem-webhook.ts`: API Gateway triggered Lambda. Validate incoming webhook payload, normalize to WorkItem format. Integrate normalizer, deduplication, EventBridge publishing. Implement retry logic with exponential backoff capped at 5 minutes.
    - **REFACTOR**: Ensure payload validation returns actionable error messages; align retry pattern with ServiceNow poller
    - _Requirements: 1.3, 1.5_

  - [x] 4.6 Implement EventBridge event publisher for Ingestion
    - **RED**: Write tests: (1) valid work item produces conformant `work-item.created` event, (2) event passes JSON Schema validation, (3) correlationId is propagated from input, (4) invalid event fails schema validation before publish
    - **GREEN**: Create `src/contexts/ingestion/publisher.ts`: publishes `work-item.created` events conforming to EventEnvelope standard and JSON Schema contract. Validate events against schema before publishing. Include correlationId propagation.
    - **REFACTOR**: Extract schema validation into shared contract-validator usage; ensure publisher is reusable across contexts
    - _Requirements: 1.4, 15.4_

  - [x] 4.7 Write unit tests for Ingestion context (consolidation)
    - **RED**: Write edge-case tests not covered above: concurrent duplicate detection, malformed ServiceNow API responses, SES rule routing errors, webhook timeout scenarios
    - **GREEN**: Implement test cases covering all edge paths
    - **REFACTOR**: Extract test fixtures into shared test utilities; ensure test coverage > 80% for ingestion context
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_


- [x] 5. Agent Orchestration Context
  - [x] 5.1 Create Orchestration Terraform module
    - **RED**: Write a `terraform validate` check for the orchestration context module
    - **GREEN**: Create `terraform/contexts/orchestration/main.tf` with S3 backend key `forgeadmin/orchestration/terraform.tfstate`. Create `terraform/contexts/orchestration/dynamodb.tf`: orchestration table with GSIs (`status-createdAt-index`, `category-riskLevel-index`), DynamoDB Streams enabled, `force_destroy = true`. Create `terraform/contexts/orchestration/step-functions.tf`: state machine definition for multi-agent flow (Triage → Research → Planning → Confidence Check → Approval Gate → Execution → Verification → Documentation). Include Choice state after Planning: if confidence < 30, route to immediate escalation step. Create `terraform/contexts/orchestration/lambda.tf`: Lambda functions for each agent step + event handlers. Create `terraform/contexts/orchestration/iam.tf`: roles for Step Functions, Lambdas, Bedrock access. SSM lookups for EventBridge bus ARN, Cognito pool ID.
    - **REFACTOR**: Validate Step Functions ASL definition passes linting; ensure IAM roles follow least-privilege; verify Choice state condition is correct
    - _Requirements: 2.1, 3.1, 4.1, 4.5, 7.1, 15.1, 15.2_

  - [x] 5.2 Implement hexagonal architecture ports and domain models
    - **RED**: Write type-checking tests asserting all port interfaces compile and domain models enforce their constraints (e.g., ConfidenceScore 0-100, max 20 plan steps)
    - **GREEN**: Create `src/contexts/orchestration/domain/ports/IKnowledgeBase.ts`. Create `src/contexts/orchestration/domain/ports/IEventPublisher.ts`. Create `src/contexts/orchestration/domain/ports/IModelInvoker.ts`. Create `src/contexts/orchestration/domain/ports/IStateStore.ts`. Create `src/contexts/orchestration/domain/ports/IServiceNowClient.ts`. Create `src/contexts/orchestration/domain/ports/ISkillSteeringProvider.ts`. Create `src/contexts/orchestration/domain/models/work-item.ts`: WorkItem entity with classification fields. Create `src/contexts/orchestration/domain/models/execution-plan.ts`: ExecutionPlan with steps, confidence score, justification. Create `src/contexts/orchestration/domain/models/confidence-score.ts`: ConfidenceScore value object with factor breakdown. Create `src/contexts/orchestration/domain/models/knowledge-item.ts`: KnowledgeItem with relevance scoring.
    - **REFACTOR**: Ensure domain models are immutable (readonly properties); validate value object invariants are enforced in constructors
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3, 17.5_

  - [x] 5.3 Implement Triage Agent domain logic
    - **RED**: Write tests: (1) valid work item produces exactly one category, one risk level, one urgency level, (2) work item with missing attributes defaults to high risk/high urgency with justification noting missing fields, (3) classification completes within simulated 30-second timeout, (4) timeout preserves partial results and defaults unassigned fields, (5) justification references input attributes
    - **GREEN**: Create `src/contexts/orchestration/domain/agents/triage.ts`. Implement classification into exactly one category: account/service request, health remediation, security alert, knowledge capture. Implement risk level assignment: low (single-system, reversible), medium (multi-system, partially reversible), high (environment-wide, irreversible). Implement urgency level assignment: critical (1hr SLA), high (4hr), normal (24hr), low (no SLA pressure). Generate justification string referencing input attributes for each decision. Handle insufficient attributes: default high risk, high urgency, justification noting missing fields. Implement 30-second timeout handling: preserve partial results, default unassigned fields to high/critical.
    - **REFACTOR**: Extract classification rules into configurable rule sets; ensure justification generation is consistent
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 5.4 Write property tests for Triage Agent — Classification completeness
    - **RED**: Write fast-check property test: for any valid work item input, triage MUST produce exactly one category, one risk level, one urgency level
    - **GREEN**: Implement arbitrary generators for work item inputs; run property test and fix any violations
    - **REFACTOR**: Add shrinking for minimal failing case identification; ensure generators cover edge cases (empty strings, extreme values)
    - _Validates: Requirements 2.1, 2.2, 2.3_

  - [x] 5.5 Implement Research Agent domain logic
    - **RED**: Write tests: (1) query returns ranked items with relevance scores, (2) items below 0.3 threshold are filtered, (3) max 10 items returned, (4) no items above threshold flags knowledge gap, (5) KB unavailability returns failure notification with "KB unavailable" flag, (6) completes within 15 seconds
    - **GREEN**: Create `src/contexts/orchestration/domain/agents/research.ts`. Query Knowledge Base using work item classification category and extracted keywords. Return ranked list of up to 10 items with relevance score (0.0-1.0), minimum threshold 0.3. Handle knowledge gap: flag item for runbook creation when no items meet threshold. Handle KB unavailability: notify requesting agent, flag item as lacking knowledge context, append "KB unavailable" flag to results. Implement 15-second completion timeout.
    - **REFACTOR**: Extract relevance threshold to configuration; ensure ranking algorithm is stable (deterministic ordering for equal scores)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 14.1_

  - [x] 5.6 Implement Planning Agent domain logic
    - **RED**: Write tests: (1) generates plan with ordered steps ≤20, each with description/expected outcome/rollback, (2) calculates confidence 0-100 with factor breakdown, (3) justification references at least one KB item by ID, (4) links to ServiceNow ticket, (5) confidence < 30 triggers immediate escalation (within 5-minute SLA), (6) caps confidence at 50 when "KB unavailable" flag is present, (7) research timeout triggers operator notification, (8) escalation summary includes research attempted, gaps identified, and reason confidence threshold not met
    - **GREEN**: Create `src/contexts/orchestration/domain/agents/planning.ts`. Generate execution plan: ordered steps (max 20) with description, expected outcome, rollback procedure specifying target restoration state. Calculate Confidence Score (0-100) with factor breakdown. Cap confidence at 50 when KB unavailable flag is present in research results. Generate structured justification referencing at least one KB item by identifier. Link proposals to originating ServiceNow ticket. Implement confidence threshold escalation: if score < 30, escalate immediately (synchronous — no timer delay) with findings summary listing research attempted, gaps identified, and reason. Handle research timeout/problems: notify operator with ticket reference and issue nature.
    - **REFACTOR**: Extract confidence calculation into pure function with testable factor weights; ensure escalation path is clearly separated from happy path
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 14.1_

  - [x] 5.7 Write property tests for Planning Agent — Confidence monotonicity and Plan boundedness
    - **RED**: Write fast-check property tests: (1) higher KB relevance scores produce higher confidence scores (given same inputs otherwise), (2) every generated plan has ≤20 steps, (3) every step has rollback OR manual flag
    - **GREEN**: Implement arbitrary generators for research results; run property tests and fix any violations
    - **REFACTOR**: Ensure confidence monotonicity holds across edge cases; add generators for boundary conditions
    - _Validates: Requirements 4.1, 4.2_

  - [x] 5.8 Implement Verification Agent domain logic
    - **RED**: Write tests: (1) all steps matching expected outcome → pass, (2) any mismatch → flag for human review + notify Teams/Slack, (3) verification failure/timeout (60s) → flag + notify, (4) all-pass updates ServiceNow with resolution details, (5) verification at exactly 60 seconds is treated as success
    - **GREEN**: Create `src/contexts/orchestration/domain/agents/verification.ts`. Compare each step's actual outcome (exit code, state change, output) against expected outcome. Record pass/fail per step. Flag work item for human review on mismatch, notify Teams/Slack with details. Handle verification failure/timeout (60 seconds): flag for human review, notify channel. Update ServiceNow on all-pass: resolution details, verification results, timestamp.
    - **REFACTOR**: Extract outcome comparison into strategy pattern (exit code vs state vs output); ensure notification payload is consistent
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.9 Implement Supervisor Agent and Step Functions wiring
    - **RED**: Write tests: (1) medium/high risk routes to Approval Gate, (2) low risk + confidence > threshold auto-executes with notification, (3) re-checks approval status before dispatching to Execution queue — if rejected, cancels, (4) SLA timer sends reminder after first period, escalates after second, (5) rejection cancels action and notifies module, (6) third SLA timeout auto-rejects, (7) definitive agent failure removes agent from pipeline, reroutes to humans, publishes degradation event, (8) sensitive data detected and unusable after redaction escalates to human operator without LLM processing
    - **GREEN**: Create `src/contexts/orchestration/domain/agents/supervisor.ts`: routes work items, manages approval gates, handles circuit breaker state, handles agent failure degradation, handles sensitive data escalation. Implement approval routing: medium/high risk → Approval Gate; low risk + confidence > threshold → auto-execute. Implement cancellation check: before dispatching to Execution queue, re-check approval status; if rejected during race condition, cancel immediately. Implement SLA timer for approvals (default 30min, configurable 5min-24hr), reminder + escalation logic. Implement rejection handling: cancel action, notify module, retain in audit. Handle escalation timeout (third SLA period): auto-reject, log, notify all. Implement agent failure handling: detect definitive failure, remove from Step Functions flow, reroute affected work items to human operators, publish degradation event with agent identity and timestamp. Implement sensitive data escalation: if redaction renders data unusable, escalate to human operator, log reason in audit trail, notify Teams/Slack.
    - **REFACTOR**: Extract SLA/escalation logic into separate timer service; ensure cancellation check is atomic (no TOCTOU race)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 13.2, 14.3_

  - [x] 5.10 Implement Orchestration adapters (Bedrock, EventBridge, DynamoDB, KB client, ServiceNow)
    - **RED**: Write integration tests: (1) Bedrock adapter returns model response in expected format, (2) EventBridge adapter validates event before publish, (3) DynamoDB adapter round-trips work item correctly, (4) KB client handles unavailability gracefully, (5) ServiceNow client attaches work notes
    - **GREEN**: Create `src/contexts/orchestration/adapters/bedrock-model.ts`: implements IModelInvoker using Bedrock API. Create `src/contexts/orchestration/adapters/eventbridge-publisher.ts`: implements IEventPublisher with schema validation. Create `src/contexts/orchestration/adapters/dynamodb-state.ts`: implements IStateStore with single-table design. Create `src/contexts/orchestration/adapters/knowledge-base-client.ts`: implements IKnowledgeBase calling KB context. Create `src/contexts/orchestration/adapters/servicenow-client.ts`: implements IServiceNowClient for work note attachment.
    - **REFACTOR**: Ensure adapters are stateless and easily mockable; extract AWS SDK client creation to factory
    - _Requirements: 3.1, 4.1, 8.1, 15.2_

  - [x] 5.11 Implement Lambda handlers (thin wiring layer)
    - **RED**: Write tests: (1) `on-work-item-created` handler starts Step Functions execution with correct input, (2) `on-execution-completed` handler resumes verification step, (3) `on-approval-decision` handler resumes Step Functions via callback token, (4) handlers from both Dashboard and Communication approval.decision events are processed identically
    - **GREEN**: Create `src/contexts/orchestration/handlers/on-work-item-created.ts`: EventBridge trigger, starts Step Functions execution. Create `src/contexts/orchestration/handlers/on-execution-completed.ts`: EventBridge trigger, resumes verification step. Create `src/contexts/orchestration/handlers/step-function-tasks.ts`: individual task handlers wiring domain agents to adapters. Create `src/contexts/orchestration/handlers/on-approval-decision.ts`: callback token handler resuming Step Functions (handles approval.decision from both Dashboard and Communication sources).
    - **REFACTOR**: Ensure handlers are thin (< 20 lines logic); validate error handling wraps all adapter calls
    - _Requirements: 2.1, 7.1, 12.4_

  - [x] 5.12 Implement Documentation Agent domain logic
    - **RED**: Write tests: (1) generates work note with resolution summary, root cause, steps taken, affected systems, (2) attaches work note to ServiceNow incident via adapter, (3) retries ServiceNow attachment 3 times at 30-second intervals on failure, (4) notifies Teams/Slack on persistent ServiceNow failure even if audit unavailable, (5) logs failure to audit when available, (6) triggers KB update event for knowledge gap items, (7) publishes `work-item.resolved` event on successful completion, (8) notifies Teams/Slack of new runbook (≤200 chars summary + link)
    - **GREEN**: Create `src/contexts/orchestration/domain/agents/documentation.ts`. Implement work note generation: resolution summary, root cause, steps taken, affected systems. Attach work notes to ServiceNow incident via IServiceNowClient adapter. Implement retry logic for ServiceNow API calls (3 attempts, 30-second intervals). On persistent failure: notify Teams/Slack regardless of audit availability; log to audit when available. Trigger runbook generation for knowledge gap items (publish event to KB context). Publish `work-item.resolved` event as the final pipeline step. Notify Teams/Slack on new runbook generation (≤200 character summary + link).
    - **REFACTOR**: Extract retry logic into shared utility (reuse from ingestion context); ensure ServiceNow adapter is mockable for testing
    - _Requirements: 3.5, 8.1, 8.2, 8.3, 8.5, 8.6_

  - [x] 5.13 Implement sensitive data redaction module
    - **RED**: Write tests: (1) detects and redacts credentials/API keys, (2) detects and redacts PII (names, SSNs, emails, phone numbers), (3) detects and redacts secrets (passwords, certificates), (4) replaces with consistent redaction placeholder, (5) returns `unusableAfterRedaction: true` when redaction would remove data essential for resolution, (6) redacted content is still structurally valid JSON/text
    - **GREEN**: Create `src/shared/redaction.ts`: detect and redact credentials, API keys, tokens, PII (names, SSNs, emails, phone numbers), secrets (passwords, certificates) before LLM calls. Replace with redaction placeholders. Return a result indicating whether redaction rendered data unusable for resolution.
    - **REFACTOR**: Extract detection patterns into configurable regex registry; ensure false positive rate is acceptable; add bypass for already-redacted content
    - _Requirements: 13.2_

  - [x] 5.14 Write unit tests for Orchestration domain agents (consolidation)
    - **RED**: Write remaining edge-case tests: supervisor concurrent state handling, research with conflicting KB items, planning with empty research results, verification partial failures, documentation with audit system down, sensitive data in various positions within work item content
    - **GREEN**: Implement all remaining test cases
    - **REFACTOR**: Ensure test coverage > 80% for orchestration domain; extract common test helpers
    - _Requirements: 2.1-2.7, 3.1-3.6, 4.1-4.6, 5.1-5.7, 7.1-7.5, 8.1-8.6, 13.2_

- [x] 6. Checkpoint — Ingestion and Orchestration validation
  - Run all tests (`npm run test`). Ensure all pass. Ask the user if questions arise.


- [x] 7. Knowledge Base Context
  - [x] 7.1 Create Knowledge Base Terraform module
    - **RED**: Write a `terraform validate` check for the knowledge-base context module
    - **GREEN**: Create `terraform/contexts/knowledge-base/main.tf` with S3 backend key `forgeadmin/knowledge-base/terraform.tfstate`. Create `terraform/contexts/knowledge-base/bedrock.tf`: Bedrock Knowledge Base configuration, data source (S3 bucket). Create `terraform/contexts/knowledge-base/dynamodb.tf`: knowledge gap tracker table, `force_destroy = true`. Create `terraform/contexts/knowledge-base/s3.tf`: KB source documents bucket, runbooks bucket (versioned), `force_destroy = true`. Create `terraform/contexts/knowledge-base/lambda.tf`: query handler, runbook generator, KB updater Lambda functions. Create `terraform/contexts/knowledge-base/iam.tf`: Bedrock access, S3 read/write roles.
    - **REFACTOR**: Validate Bedrock KB configuration matches expected embedding model; ensure S3 versioning is enabled on runbooks bucket
    - _Requirements: 3.1, 8.1, 8.2, 15.1, 15.2_

  - [x] 7.2 Implement KB query handler
    - **RED**: Write tests: (1) returns ranked items scored 0.0-1.0, (2) filters items below 0.3 threshold, (3) returns max 10 items, (4) handles Bedrock KB unavailability gracefully (returns empty with error flag), (5) items are sorted by relevance descending
    - **GREEN**: Create `src/contexts/knowledge-base/handlers/query-handler.ts`: receives research queries, queries Bedrock KB. Implement relevance scoring (0.0-1.0), filter items below 0.3 threshold. Return ranked list of up to 10 knowledge items. Handle Bedrock KB unavailability gracefully.
    - **REFACTOR**: Extract Bedrock query construction into testable helper; ensure scoring normalization is consistent
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 7.3 Implement runbook generator
    - **RED**: Write tests: (1) generates runbook with all required fields (title, applicable incident types, prerequisites, step-by-step procedure, expected outcomes, rollback steps), (2) stores in S3 with versioning, (3) publishes `runbook.generated` event, (4) handles 10-minute soft timeout (continues rather than failing), (5) generated runbook is valid markdown
    - **GREEN**: Create `src/contexts/knowledge-base/handlers/runbook-generator.ts`: triggered by `work-item.resolved` events for knowledge gap items. Generate structured runbooks containing: title, applicable incident types, prerequisites, step-by-step procedure, expected outcomes, rollback steps. Store in S3 with versioning. Publish `runbook.generated` event. 10-minute soft timeout (continue if still processing).
    - **REFACTOR**: Extract runbook template into configurable format; ensure S3 key structure supports efficient listing
    - _Requirements: 8.2, 8.3, 8.5_

  - [x] 7.4 Implement KB updater
    - **RED**: Write tests: (1) updates KB with resolution steps, root cause, affected systems on `execution.completed`, (2) retry 3 times at 30-second intervals on failure, (3) notifies Teams/Slack on persistent failure, (4) handles `verification.completed` events
    - **GREEN**: Create `src/contexts/knowledge-base/handlers/kb-updater.ts`: triggered by `execution.completed` and `verification.completed` events. Update KB with resolution steps, root cause, affected systems. Implement retry logic (3 attempts, 30-second intervals) on failure. Notify Teams/Slack channel on persistent failure.
    - **REFACTOR**: Reuse shared retry utility; ensure KB document format is consistent with query handler expectations
    - _Requirements: 3.5, 8.1, 8.6_

  - [x] 7.5 Write unit tests for Knowledge Base context (consolidation)
    - **RED**: Write edge-case tests: concurrent KB updates, malformed event payloads, S3 write failures, Bedrock rate limiting
    - **GREEN**: Implement all edge-case test scenarios
    - **REFACTOR**: Ensure test coverage > 80%; validate all error paths are exercised
    - _Requirements: 3.1-3.6, 8.1-8.6_

- [x] 8. Execution Layer Context
  - [x] 8.1 Create Execution Layer Terraform module
    - **RED**: Write a `terraform validate` check for the execution context module
    - **GREEN**: Create `terraform/contexts/execution/main.tf` with S3 backend key `forgeadmin/execution/terraform.tfstate`. Create `terraform/contexts/execution/sqs.tf`: execution queue (max concurrency=1), DLQ. Create `terraform/contexts/execution/dynamodb.tf`: execution state table with GSI `planId-index`, DynamoDB Streams enabled, `force_destroy = true`. Create `terraform/contexts/execution/lambda.tf`: execution handler Lambda, callback handler Lambda, timeout handler Lambda, connectivity monitor Lambda. Create `terraform/contexts/execution/api-gateway.tf`: callback endpoint for jump server. Create `terraform/contexts/execution/secrets.tf`: Secrets Manager for mTLS certificates. Create `terraform/contexts/execution/iam.tf`: roles with Transit Gateway, Secrets Manager access.
    - **REFACTOR**: Validate SQS max concurrency configuration; ensure DLQ has appropriate alarm
    - _Requirements: 6.1, 6.5, 14.2, 15.1, 15.2_

  - [x] 8.2 Implement hexagonal ports and execution bridge interface
    - **RED**: Write type-checking tests asserting all port interfaces compile and model constraints hold (timeout max 10 min, step index non-negative)
    - **GREEN**: Create `src/contexts/execution/domain/ports/IExecutionBridge.ts`: submitCommand, getStatus interfaces. Create `src/contexts/execution/domain/ports/IStateStore.ts`: execution state persistence. Create `src/contexts/execution/domain/ports/IEventPublisher.ts`. Create `src/contexts/execution/domain/ports/IConnectivityMonitor.ts`: Transit Gateway health check interface. Create `src/contexts/execution/domain/models/execution-command.ts`: ExecutionCommand, ExecutionTicket, ExecutionStatus types. Create `src/contexts/execution/domain/models/execution-result.ts`: step results, verdicts.
    - **REFACTOR**: Ensure models enforce invariants in constructors; validate port interfaces are minimal
    - _Requirements: 6.1, 6.2, 14.2_

  - [x] 8.3 Implement execution orchestrator domain logic
    - **RED**: Write tests: (1) successful plan executes all steps sequentially, (2) any step failure halts plan immediately, (3) rollback executes within 120 seconds on failure, (4) sandbox fail verdict blocks command and halts plan, (5) missing rollback halts plan and escalates for manual intervention, (6) 10-minute timeout with no callback marks failed, (7) checks for cancellation/rejection flag before each step — if found, halts immediately, (8) blocked execution (approval revoked, module disabled, circuit breaker) halts and notifies
    - **GREEN**: Create `src/contexts/execution/domain/execution-orchestrator.ts`. Implement single-concurrency execution flow: receive plan → evaluate in MXC sandbox → execute via JEA → callback handling. Implement pre-step cancellation check: before each step, check for `plan.rejected` event or cancellation flag in DynamoDB; if found, halt immediately. Implement halt-always-on-failure: any step failure halts plan immediately. Implement rollback execution within 120 seconds on failure. Handle sandbox fail verdict: block command, halt plan, notify. Handle missing rollback: halt plan, preserve state, escalate for manual intervention. Handle blocked execution (approval revoked, module disabled, circuit breaker): halt and notify. 10-minute timeout: no callback = mark failed.
    - **REFACTOR**: Extract halt/notify logic into shared handler; ensure cancellation check is performant (DynamoDB consistent read)
    - _Requirements: 5.2, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8_

  - [x] 8.4 Implement execution adapters (mTLS bridge, DynamoDB, EventBridge)
    - **RED**: Write tests: (1) mTLS bridge submits command via HTTPS through Transit Gateway, (2) DynamoDB adapter persists and retrieves execution state, (3) EventBridge publisher emits `execution.completed` and `execution.failed` events with valid schema
    - **GREEN**: Create `src/contexts/execution/adapters/mtls-bridge.ts`: implements IExecutionBridge, HTTPS communication via Transit Gateway with mTLS. Create `src/contexts/execution/adapters/dynamodb-state.ts`: implements IStateStore for execution state. Create `src/contexts/execution/adapters/eventbridge-publisher.ts`: publishes `execution.completed` and `execution.failed` events. Load mTLS certificates from Secrets Manager.
    - **REFACTOR**: Ensure mTLS certificate loading is cached (not fetched per invocation); validate certificate rotation handling
    - _Requirements: 6.1, 6.5_

  - [x] 8.5 Implement Lambda handlers for Execution context
    - **RED**: Write tests: (1) SQS handler processes one message at a time (max concurrency=1), (2) callback handler validates jump server response and resumes orchestrator, (3) timeout handler detects stale executions after 10 minutes and marks failed
    - **GREEN**: Create `src/contexts/execution/handlers/sqs-handler.ts`: SQS trigger (max concurrency=1), wires orchestrator to adapters. Create `src/contexts/execution/handlers/callback-handler.ts`: API Gateway endpoint receiving jump server callbacks. Create `src/contexts/execution/handlers/timeout-handler.ts`: EventBridge scheduled rule checking for stale executions (10-min timeout).
    - **REFACTOR**: Ensure handlers are thin wiring; validate SQS message visibility timeout aligns with execution timeout
    - _Requirements: 6.1, 6.4_

  - [x] 8.6 Implement Transit Gateway connectivity monitoring and queue management
    - **RED**: Write tests: (1) connection loss detected and operators notified within 60 seconds, (2) approved actions queued for max 60 minutes, (3) connectivity retried at 30-second intervals, (4) queue exceeding 60 minutes escalates all items to human operators, (5) connection restoration resumes normal execution
    - **GREEN**: Create `src/contexts/execution/handlers/connectivity-monitor.ts`: monitors Transit Gateway connection health. Queue approved actions for max 60 minutes on connection loss. Retry connectivity at 30-second intervals. Notify operators within 60 seconds of connection loss. Escalate all queued items to human operators after 60-minute queue. Resume normal execution on connectivity restoration.
    - **REFACTOR**: Extract queue management into separate testable module; ensure queue doesn't grow unbounded during extended outage
    - _Requirements: 14.2_

  - [x] 8.7 Write unit tests for Execution Layer (consolidation)
    - **RED**: Write edge-case tests: concurrent SQS messages (should be impossible but verify), callback with expired execution, partial rollback failure, mTLS certificate expiry, connectivity flap (rapid loss/restore cycles)
    - **GREEN**: Implement all edge-case test scenarios
    - **REFACTOR**: Ensure test coverage > 80%; validate all halt paths are exercised
    - _Requirements: 6.1-6.8, 14.2_

- [x] 9. Checkpoint — Core pipeline validation
  - Run all tests (`npm run test`). Run `terraform validate` on all modules. Ask the user if questions arise.


- [x] 10. Dashboard & API Context
  - [x] 10.1 Create Dashboard Terraform module
    - **RED**: Write a `terraform validate` check for the dashboard context module
    - **GREEN**: Create `terraform/contexts/dashboard/main.tf` with S3 backend key `forgeadmin/dashboard/terraform.tfstate`. Create `terraform/contexts/dashboard/s3-cloudfront.tf`: S3 bucket for SPA, CloudFront distribution. Create `terraform/contexts/dashboard/api-gateway.tf`: REST API Gateway with Cognito authorizer, WebSocket API with heartbeat configuration (30-second ping interval). Create `terraform/contexts/dashboard/dynamodb.tf`: module config and approvals table with GSIs (`state-index`, `approval-status-index`), `force_destroy = true`. Create `terraform/contexts/dashboard/lambda.tf`: API handler Lambdas, WebSocket connection handler, WebSocket heartbeat Lambda. Create `terraform/contexts/dashboard/iam.tf`: API Gateway, Lambda, DynamoDB roles.
    - **REFACTOR**: Validate CloudFront distribution caching rules; ensure CORS configuration is correct; verify WebSocket idle timeout > heartbeat interval
    - _Requirements: 11.1, 11.5, 15.1, 15.2_

  - [x] 10.2 Implement Dashboard API Lambda handlers
    - **RED**: Write tests: (1) GET /modules returns all modules with state/confidence/last execution, (2) PATCH /modules/:id/state applies transition immediately (returns `disabling` for disable), (3) GET /approvals/pending returns pending items with full context, (4) POST /approvals/:id/decision records decision with identity/timestamp/rationale, (5) team_lead role has full access, (6) team_member role can approve/view but cannot modify module config or add skills, (7) invalid role gets 403, (8) GET /agents/:name/token-budget returns correct token consumption breakdown
    - **GREEN**: Create `src/contexts/dashboard/api/handlers/modules.ts`: GET /modules (list with state, confidence, last execution), PATCH /modules/:id/state, PATCH /modules/:id/config. Create `src/contexts/dashboard/api/handlers/approvals.ts`: GET /approvals/pending (with full context), POST /approvals/:id/decision (approve/reject with rationale). Create `src/contexts/dashboard/api/handlers/executions.ts`: GET /executions (filterable by module, date, risk, outcome, 90-day history). Create `src/contexts/dashboard/api/handlers/audit.ts`: GET /audit (filterable audit trail). Create `src/contexts/dashboard/api/handlers/token-budget.ts`: GET /agents/:name/token-budget (calculates token consumption from skills/steering DynamoDB table and S3 content). Implement RBAC middleware: `team_lead` (full access: approvals, module configuration, skill addition), `team_member` (approvals, audit trail viewing, read-only module configuration). Implement request validation from OpenAPI spec.
    - **REFACTOR**: Extract RBAC middleware into shared utility; ensure all endpoints return consistent error format
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 13.3, 17.9_

  - [x] 10.3 Implement module state management and promotion logic
    - **RED**: Write tests: (1) enable→disable transition immediately shows `disabling` state, transitions to `disabled` after 300s, (2) force-stop after 300s grace period for in-progress items, (3) enable↔shadow transitions are immediate, (4) auto-suggest promotion recommends when accuracy exceeds threshold over evaluation window, (5) manual promotion only advances on explicit team_lead trigger, (6) promotion rejection logs rationale and blocks re-recommendation until next window, (7) publishes `module.state-changed` events
    - **GREEN**: Create `src/contexts/dashboard/domain/module-manager.ts`: state transitions (enabled/disabling/disabled/shadow), 300-second grace period on disable with immediate Dashboard state update (`disabling`), force-stop after grace period. Create `src/contexts/dashboard/domain/promotion-manager.ts`: manual vs auto-suggest promotion, accuracy metrics calculation, evaluation window management (7-90 days configurable), accuracy threshold (0-100). Publish `module.state-changed` events on transitions. Log promotion rejections, enforce 365-day retention for promotion history.
    - **REFACTOR**: Extract state machine into separate testable class; ensure grace period timer is cancelable
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.3_

  - [x] 10.4 Write property tests for module state management — State machine validity
    - **RED**: Write fast-check property test: only valid transitions occur (enabled↔disabled via disabling, enabled↔shadow, disabled↔shadow); concurrent operations don't corrupt state
    - **GREEN**: Implement arbitrary generators for state transition sequences; verify invariants hold
    - **REFACTOR**: Add edge case generators (rapid toggle, concurrent operations); ensure property coverage is comprehensive
    - _Validates: Requirements 9.1, 9.4, 9.5, 9.6_

  - [x] 10.5 Implement WebSocket real-time updates with resilience
    - **RED**: Write tests: (1) new WebSocket connection is stored in DynamoDB, (2) disconnection removes connection, (3) module state change event fans out to all connected clients within 5 seconds, (4) approval events reach connected clients, (5) execution events reach connected clients, (6) server sends heartbeat ping every 30 seconds, (7) missed heartbeat marks connection as stale, (8) stale connections are cleaned up
    - **GREEN**: Create `src/contexts/dashboard/websocket/connection-handler.ts`: manage WebSocket connections in DynamoDB. Create `src/contexts/dashboard/websocket/event-fan.ts`: EventBridge → WebSocket fan-out for module state changes, approvals, execution events. Create `src/contexts/dashboard/websocket/heartbeat.ts`: scheduled Lambda sending ping every 30 seconds; detect and clean up stale connections. Implement 5-second refresh guarantee for state changes.
    - **REFACTOR**: Implement connection cleanup for stale connections; ensure fan-out handles connection errors gracefully; add connection TTL for automatic cleanup
    - _Requirements: 11.1, 11.3_

  - [x] 10.6 Implement React SPA frontend with WebSocket resilience
    - **RED**: Write component tests: (1) module dashboard renders state/confidence/last execution for each module, (2) state toggle shows `disabling` transitional state, (3) approval queue shows pending items with full context, (4) execution history is filterable, (5) module config controls accept 0-100 threshold, (6) team_member role cannot see modification controls, (7) WebSocket disconnection triggers automatic reconnection with exponential backoff, (8) staleness indicator shows when data is > 5 seconds old, (9) token budget indicator shows percentage consumed per agent
    - **GREEN**: Initialize Vite + React + TypeScript project in `src/contexts/dashboard/frontend/`. Create Zustand store with slices: modules, approvals, executions, audit, websocket (connection state, last-updated timestamp, reconnection logic). Implement module dashboard view: state (including `disabling` transitional), confidence scores, last execution, state toggle controls. Implement approval queue view: pending approvals with confidence, justification, plan, risk level, ticket link. Implement execution history view: filterable by module, date, risk, outcome (90-day history). Implement module configuration view: confidence threshold (0-100), promotion strategy (manual/auto-suggest), evaluation window (7-90 days). Implement token budget indicator per agent (calls GET /agents/:name/token-budget). Implement WebSocket resilience: automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s), full state snapshot fetch on reconnect, "last updated" staleness badge (warning when > 5 seconds stale). Implement RBAC-aware UI: hide modification/skill-addition controls for `team_member` role. Auto-generate TypeScript types from OpenAPI spec.
    - **REFACTOR**: Extract shared UI components (filters, tables, state badges); ensure accessibility (ARIA labels, keyboard navigation); extract WebSocket connection management into a reusable hook
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 10.1, 10.5, 13.3, 17.9_

  - [x] 10.7 Write unit tests for Dashboard API and domain logic (consolidation)
    - **RED**: Write edge-case tests: concurrent state transitions, expired approval decisions, promotion window edge (exactly at threshold), force-stop timing, token budget with zero active documents, token budget exceeding context window
    - **GREEN**: Implement all edge-case test scenarios
    - **REFACTOR**: Ensure test coverage > 80%; validate integration between module-manager and promotion-manager
    - _Requirements: 9.1-9.6, 10.1-10.6, 11.1-11.6, 13.3, 17.9_


- [x] 11. Communication Context
  - [x] 11.1 Create Communication Terraform module
    - **RED**: Write a `terraform validate` check for the communication context module
    - **GREEN**: Create `terraform/contexts/communication/main.tf` with S3 backend key `forgeadmin/communication/terraform.tfstate`. Create `terraform/contexts/communication/sqs.tf`: communication queue (rate limit isolation), DLQ. Create `terraform/contexts/communication/dynamodb.tf`: notification state + identity mapping table (30-day TTL for notifications, no TTL for identity mappings), GSIs (`cognitoUserId-index`, `status-index`), `force_destroy = true`. Create `terraform/contexts/communication/lambda.tf`: notification dispatcher, morning digest, NL command handler, escalation handler, identity sync Lambda. Create `terraform/contexts/communication/eventbridge.tf`: scheduled rule for 7:00 AM ET morning digest, event rules for notification triggers. Create `terraform/contexts/communication/ses.tf`: SES verified identity for outbound notification emails (escalation fallback). Create `terraform/contexts/communication/iam.tf`: Lambda roles with SQS, DynamoDB, EventBridge, SES send access.
    - **REFACTOR**: Validate SES identity is in correct region; ensure DLQ alarm is configured; verify identity mapping table has no TTL
    - _Requirements: 12.1, 12.2, 12.4, 15.1, 15.2_

  - [x] 11.2 Implement notification dispatcher with escalation
    - **RED**: Write tests: (1) routes auto-executed action event to Teams/Slack within 30 seconds, (2) routes approval request to Teams/Slack, (3) routes execution failure to Teams/Slack, (4) routes circuit breaker trip to Teams/Slack within 60 seconds, (5) routes `runbook.generated` event with ≤200 char summary + link, (6) retry 3 times with exponential backoff on delivery failure, (7) escalates to SES email when 30-second timing violated, (8) escalates to Dashboard alert (publishes `notification.failed` event) when both Teams/Slack and email fail, (9) logs failures in audit trail, (10) handles `dlq.message-received` events with source queue context, (11) handles `skill.updated` and `steering.updated` events
    - **GREEN**: Create `src/contexts/communication/handlers/notification-dispatcher.ts`: routes events to Teams/Slack within 30 seconds. Implement three-tier escalation ladder: Primary (Teams/Slack) → Secondary (SES email, triggered on timing violation or 3 failed retries) → Tertiary (publish `notification.failed` event for Dashboard alert). Implement notification types: auto-executed actions, approval requests, execution failures, system alerts (circuit breaker, degradation, ingestion failures), `runbook.generated` (≤200 char summary + link), `dlq.message-received` (source queue, message count, oldest message age), `skill.updated`/`steering.updated` (doc title, target agent/scope, action, team lead identity). Log all delivery failures in audit trail. Display undelivered notifications on Dashboard via `notification.failed` event.
    - **REFACTOR**: Extract notification formatting into templates per event type; ensure retry backoff is configurable; extract escalation logic into a reusable EscalationService class
    - _Requirements: 12.1, 12.3, 12.5, 8.5, 17.12_

  - [x] 11.3 Implement morning digest generator
    - **RED**: Write tests: (1) generates digest at 7:00 AM Eastern covering 7PM-7AM window, (2) includes activity summary, (3) includes pending approvals with age, (4) includes module health for all enabled modules, (5) includes anomalies (circuit breaker trips, error rate breaches, agent failures, ingestion outages), (6) delivers to Teams/Slack
    - **GREEN**: Create `src/contexts/communication/handlers/morning-digest.ts`: scheduled at 7:00 AM Eastern. Compile overnight activity (7PM-7AM): activity summary, pending approvals with age, module health for all enabled modules, anomalies (circuit breaker trips, error rate breaches, agent failures, ingestion outages). Format for Teams/Slack delivery.
    - **REFACTOR**: Extract digest sections into composable generators; ensure timezone handling is correct across DST transitions
    - _Requirements: 12.2_

  - [x] 11.4 Implement Teams/Slack identity mapping service
    - **RED**: Write tests: (1) lookup returns Cognito role for known Teams/Slack user ID, (2) unknown Teams/Slack user returns null (unauthorized), (3) mapping supports team_lead and team_member roles, (4) identity sync Lambda updates mapping from Cognito user pool attributes, (5) stale mapping (lastVerified > 24 hours) triggers re-verification before command execution
    - **GREEN**: Create `src/contexts/communication/handlers/identity-mapper.ts`: DynamoDB lookup mapping Teams/Slack user IDs to Cognito users. Create `src/contexts/communication/handlers/identity-sync.ts`: scheduled Lambda synchronizing Cognito user pool attributes (including custom Teams/Slack ID attribute) to the identity mapping table. Implement stale detection: if lastVerified > 24 hours, re-verify against Cognito before allowing write commands.
    - **REFACTOR**: Ensure mapping lookup is fast (single DynamoDB GetItem); add caching for hot-path lookups within a single Lambda invocation
    - _Requirements: 12.4, 13.3_

  - [x] 11.5 Implement natural language command handler with authorization
    - **RED**: Write tests: (1) "what's the status of module X?" returns module state, (2) "show pending approvals" returns approval list, (3) "approve proposal ABC" publishes `approval.decision` event with approve decision, (4) "reject proposal ABC because reason" publishes `approval.decision` event with reject + rationale, (5) "disable module X" publishes `module.state-changed` command, (6) responds within 30 seconds, (7) invalid command returns helpful error, (8) `approval.decision` event from Communication source is accepted by Orchestration, (9) team_member cannot toggle modules (returns "insufficient permissions"), (10) team_lead can toggle modules, (11) unknown user gets "unrecognized user — contact your team lead for access", (12) audit trail records actor identity from identity mapping (not raw Teams/Slack ID)
    - **GREEN**: Create `src/contexts/communication/handlers/nl-command-handler.ts`: processes Teams/Slack messages. Before executing any write command, call identity mapper to resolve role. Support status queries (no auth required): module state, pending approvals, recent execution outcomes. Support commands (auth required): approve/reject pending proposals (team_member+), toggle module state (team_lead only). Respond within 30 seconds. Publish `approval.decision` events with source=`communication` and actor=Cognito identity (same schema as Dashboard). Reject unauthorized commands with helpful message. Attribute all actions to Cognito identity in audit trail.
    - **REFACTOR**: Extract NL parsing into testable module; extract authorization checks into middleware; ensure error messages guide users toward correct permissions
    - _Requirements: 12.4, 13.1, 13.3_

  - [x] 11.6 Write unit tests for Communication context (consolidation)
    - **RED**: Write edge-case tests: Teams/Slack API rate limiting, malformed NL commands, digest with zero overnight activity, notification for disabled module, identity mapping with Cognito sync failure, escalation with SES rate limit, concurrent NL commands from same user
    - **GREEN**: Implement all edge-case test scenarios
    - **REFACTOR**: Ensure test coverage > 80%; validate all escalation paths are exercised
    - _Requirements: 12.1-12.5, 13.3_


- [x] 12. Skills & Steering — Agent Growth System
  - [x] 12.1 Add Skills/Steering infrastructure to Dashboard Terraform
    - **RED**: Write a `terraform validate` check confirming the new DynamoDB table and S3 paths are valid
    - **GREEN**: Add to `terraform/contexts/dashboard/dynamodb.tf`: new `skills-steering-index` table with GSIs (`scope-type-index`, `targetAgent-type-index`), `force_destroy = true`. Add S3 paths to existing storage bucket configuration for `skills/` and `steering/` prefixes (versioned). Add Lambda functions for skills/steering CRUD API handlers. Add IAM permissions for Orchestration context to read skills-steering DynamoDB table and S3 skill/steering paths.
    - **REFACTOR**: Ensure GSI projections are minimal (only needed attributes); validate S3 versioning covers skill/steering paths
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 12.2 Implement Skills/Steering API Lambda handlers
    - **RED**: Write tests: (1) POST /skills creates skill with version 1 in S3 and DynamoDB index, (2) PUT /skills/:id creates new version (version increments), (3) DELETE /skills/:id soft-deletes (sets enabled=false), (4) POST /skills/:id/rollback/:version restores that version as current, (5) GET /skills returns filterable list by scope/agent/enabled, (6) team_lead role has full CRUD, (7) team_member role gets 403 on create/update/delete, (8) same tests for /steering endpoints, (9) publishes `skill.updated` or `steering.updated` event on create/update/delete/rollback, (10) invalid frontmatter returns 400
    - **GREEN**: Create `src/contexts/dashboard/api/handlers/skills.ts`: full CRUD for skills (GET list, GET by ID, GET versions, POST create, PUT update, DELETE soft-delete, POST rollback). Create `src/contexts/dashboard/api/handlers/steering.ts`: full CRUD for steering docs (same pattern). Implement S3 versioned writes (each update creates new version file). Implement DynamoDB index updates on each operation. Implement RBAC: `team_lead` full access, `team_member` read-only. Publish `skill.updated` / `steering.updated` events to EventBridge. Log all operations to audit trail with team_lead identity, timestamp, document version, action.
    - **REFACTOR**: Extract shared CRUD logic between skills and steering handlers (DRY — they have identical structure, different type field); ensure rollback validates target version exists before applying
    - _Requirements: 17.1, 17.2, 17.3, 17.6, 17.10, 17.11, 17.12_

  - [x] 12.3 Implement prompt composition adapter (Orchestration context)
    - **RED**: Write tests: (1) `getComposedPromptContext('triage')` returns global steering + triage-specific steering + global skills + triage-specific skills, (2) disabled docs are excluded, (3) composition order is correct (base prompt → global steering → agent-specific steering → global skills → agent-specific skills), (4) DynamoDB unavailability returns empty context with warning flag, (5) S3 fetch failure for one doc skips it and includes others, (6) malformed doc (invalid frontmatter) is skipped with error logged, (7) token budget exceeded drops lowest-priority docs first (global skills → global steering), (8) reports which docs were dropped and total token usage
    - **GREEN**: Create `src/contexts/orchestration/adapters/skill-steering-provider.ts`: implements ISkillSteeringProvider — queries DynamoDB for enabled docs by agent name and global scope, fetches content from S3, strips frontmatter, composes into PromptContext with token budget tracking. Implement token counting and priority-based truncation. Implement graceful degradation (proceed with base prompt on storage failure). Create `src/shared/token-counter.ts`: shared token counting utility.
    - **REFACTOR**: Optimize DynamoDB queries (batch get for multiple docs); implement Lambda-local caching for S3 content within a single invocation; extract token counting into shared utility
    - _Requirements: 17.5, 17.7, 17.8_

  - [x] 12.4 Integrate prompt composition into agent invocation pipeline
    - **RED**: Write tests: (1) Triage Agent receives composed prompt including active skills/steering, (2) Planning Agent receives its own skills/steering (not Triage's), (3) global docs appear in all agents' prompts, (4) base prompt is always present even when no skills/steering exist, (5) work item flagged as "operating without full skill context" when storage unavailable, (6) shadow mode module still receives skills/steering context during processing
    - **GREEN**: Update `src/contexts/orchestration/handlers/step-function-tasks.ts`: before invoking each agent, call `ISkillSteeringProvider.getComposedPromptContext(agentName)` and prepend the composed context to the agent's prompt. Update Bedrock model invocation to include composed prompt sections in priority order. Add "operating without full skill context" flag to work item metadata when degraded. Ensure shadow mode processing still invokes skills/steering composition (shadow intercepts at execution, not at prompt composition).
    - **REFACTOR**: Ensure prompt composition doesn't add latency > 200ms to agent invocation; validate composed prompt is logged (truncated) for debugging
    - _Requirements: 17.5, 17.6, 17.8, 9.2_

  - [x] 12.5 Implement Skills/Steering Dashboard UI with token budget indicator
    - **RED**: Write component tests: (1) Skills Management page lists skills grouped by scope, (2) enabled/disabled toggle calls PUT, (3) markdown editor saves on submit creating new version, (4) version history panel shows all versions with timestamps, (5) rollback button calls POST rollback endpoint, (6) token budget indicator shows percentage used per agent with document breakdown, (7) team_member role sees no edit controls, (8) Agent Detail view shows active skills/steering for that agent, (9) token budget warns when documents would be truncated
    - **GREEN**: Create Skills Management page: list view grouped by scope (global/per-agent), title, target agent, enabled toggle, version number, last updated. Create Steering Management page: same structure. Create shared document editor: markdown editor with preview, frontmatter helper. Create version history panel: chronological version list with diff view, rollback button. Create token budget indicator component: bar chart showing per-agent context window consumption, breakdown by document, warning badges for documents that would be truncated. Integrate with GET /agents/:name/token-budget endpoint. Create Agent Detail view: shows all active skills/steering with their token consumption.
    - **REFACTOR**: Extract shared list/editor/version-history components (reused between skills and steering pages); ensure accessibility (ARIA labels on toggle, keyboard-navigable editor)
    - _Requirements: 17.1, 17.2, 17.3, 17.9, 17.11_

  - [x] 12.6 Add event schemas for skill/steering updates
    - **RED**: Write contract validation test asserting `skill.updated` and `steering.updated` schemas are valid JSON Schema
    - **GREEN**: Create `contracts/events/dashboard/skill.updated.schema.json` and `contracts/events/dashboard/steering.updated.schema.json`. Schema payload includes: docId, docType, action (created/updated/deleted/rolledBack), version, actorId, targetAgent. Both follow EventEnvelope standard.
    - **REFACTOR**: Validate schema covers all action types; ensure event examples pass validation
    - _Requirements: 17.10, 17.12, 15.4_

  - [x] 12.7 Add notification handling for skill/steering changes
    - **RED**: Write tests: (1) `skill.updated` event triggers Teams/Slack notification within 30 seconds, (2) notification includes: document title, target agent/scope, action performed, team lead identity, (3) `steering.updated` event triggers same notification pattern
    - **GREEN**: Update `src/contexts/communication/handlers/notification-dispatcher.ts`: add `skill.updated` and `steering.updated` to handled event types. Format notification with: doc title, target agent or "global", action (created/updated/deleted/rolled back), team lead name.
    - **REFACTOR**: Ensure notification format is consistent with other event types; test character limits
    - _Requirements: 17.12_

  - [x] 12.8 Write unit tests for Skills & Steering (consolidation)
    - **RED**: Write edge-case tests: create skill with maximum content size, rollback to version 1 from version 50, concurrent updates to same skill, prompt composition with 20+ active docs hitting token limit, skill for non-existent agent name, steering doc with conflicting instructions to base prompt
    - **GREEN**: Implement all edge-case test scenarios
    - **REFACTOR**: Ensure test coverage > 80% for all skills/steering code paths; validate error messages are actionable
    - _Requirements: 17.1-17.12_


- [x] 13. Platform Services — Audit Trail, Circuit Breaker, Degradation, Archival, DLQ
  - [x] 13.1 Implement audit trail service
    - **RED**: Write tests: (1) EventBridge event produces audit entry in DynamoDB within 5 seconds, (2) audit entry includes: agent decisions, human approvals, execution commands, results, timestamps, ServiceNow ticket links, (3) entries are append-only (no update/delete), (4) entries are retained for minimum 365 days (via archival + Glacier), (5) timestamped entry records actor and stage outcome at each workflow stage transition
    - **GREEN**: Create `src/contexts/platform/handlers/audit-handler.ts`: EventBridge-triggered Lambda writing audit entries. Implement append-only DynamoDB writes within 5 seconds of action. Include: agent decisions, human approvals, execution commands, results, timestamps, ServiceNow ticket links. Record timestamped entry with actor identification and stage outcome at each workflow stage transition.
    - **REFACTOR**: Ensure audit writes are idempotent (handle EventBridge at-least-once delivery); validate GSI access patterns are efficient
    - _Requirements: 13.1, 16.4_

  - [x] 13.2 Implement DynamoDB-to-S3 archival automation
    - **RED**: Write tests: (1) DynamoDB Streams REMOVE event (TTL expiry) triggers archival Lambda, (2) archived item is written to correct S3 path (e.g., `audit-archive/{year}/{month}/{correlationId}.json`), (3) archived item contains full original record, (4) S3 lifecycle transitions item to Glacier after 1 year, (5) concurrent archival of multiple items doesn't lose records, (6) S3 write failure retries and preserves the stream record for reprocessing
    - **GREEN**: Create `src/contexts/platform/handlers/archival-handler.ts`: DynamoDB Streams triggered Lambda. Process REMOVE events (triggered by TTL expiry). Write full item to S3 at structured path: `{table-type}/{year}/{month}/{itemId}.json`. Handle concurrent writes. Implement retry on S3 write failure. Support archival for all DynamoDB tables with Streams enabled (audit, ingestion work items, orchestration, execution state).
    - **REFACTOR**: Extract S3 path generation into testable utility; ensure archival Lambda has appropriate batch size configuration; validate that DynamoDB Streams batch window is optimal
    - _Requirements: 13.1, 14.5_

  - [x] 13.3 Write property tests for audit trail — Audit completeness
    - **RED**: Write fast-check property test: every state transition produces exactly one audit entry; no transitions are lost
    - **GREEN**: Implement arbitrary generators for domain events; verify 1:1 mapping to audit entries
    - **REFACTOR**: Add generators for concurrent events; ensure property holds under parallel writes
    - _Validates: Requirements 13.1, 16.4_

  - [x] 13.4 Implement circuit breaker service
    - **RED**: Write tests: (1) 3 failures in rolling 15-minute window trips breaker, (2) breaker trip halts all automated execution for affected module, (3) tripped breaker routes work items to human operators, (4) publishes `circuit-breaker.tripped` event, (5) notifies Teams/Slack within 60 seconds of trip, (6) only actual trip events trigger responses (not spurious)
    - **GREEN**: Create `src/contexts/platform/handlers/circuit-breaker.ts`: monitors module error rates. Trip circuit breaker when error rate exceeds threshold (default: 3 failures in rolling 15-minute window). Halt all automated execution for affected module on trip. Route affected work items to human operators. Publish `circuit-breaker.tripped` event. Notify Teams/Slack within 60 seconds of trip.
    - **REFACTOR**: Extract rolling window calculation into shared utility; ensure thread safety for concurrent failure events
    - _Requirements: 13.4, 13.5_

  - [x] 13.5 Write property tests for circuit breaker — Circuit breaker determinism
    - **RED**: Write fast-check property test: after threshold failures within window, breaker ALWAYS trips; no auto-executions permitted after trip; below threshold, breaker NEVER trips
    - **GREEN**: Implement arbitrary generators for success/failure event sequences; verify deterministic tripping behavior
    - **REFACTOR**: Add time-based generators (failures spread across window boundary); ensure determinism holds under all timing conditions
    - _Validates: Requirements 13.4, 13.5_

  - [x] 13.6 Implement graceful degradation service
    - **RED**: Write tests: (1) component failure triggers degradation notification within 30 seconds to both Dashboard and Teams/Slack, (2) notification includes: component, start time, affected capabilities, (3) bulkhead isolation prevents cascade (module A failure doesn't affect module B), (4) recovery restores within 60 seconds, (5) recovery clears Dashboard and Teams/Slack indicators, (6) logs recovery event with total duration, (7) consumes degradation events published by Supervisor Agent, (8) if either notification channel fails, escalates the notification failure as a separate issue
    - **GREEN**: Create `src/contexts/platform/handlers/degradation-monitor.ts`: monitors component health, consumes degradation events from Supervisor Agent. Implement bulkhead isolation between modules (one module failure doesn't cascade). Display degradation notification within 30 seconds (Dashboard + Teams/Slack): component, start time, affected capabilities. On recovery: restore within 60 seconds, clear indicators, log recovery event with total duration. If either notification channel fails, escalate the notification failure as a separate issue.
    - **REFACTOR**: Extract health check logic into configurable per-component rules; ensure bulkhead boundaries align with bounded contexts
    - _Requirements: 14.3, 14.4, 14.5, 14.6_

  - [x] 13.7 Implement DLQ monitoring and alerting
    - **RED**: Write tests: (1) CloudWatch alarm for DLQ depth > 0 triggers DLQ monitor Lambda, (2) Lambda reads DLQ messages without consuming them, (3) publishes `dlq.message-received` event with: source queue, message count, oldest message age, sample error context, (4) Communication context receives event and notifies Teams/Slack, (5) for ingestion DLQ: attempts reprocessing with exponential backoff (max 3 retries), (6) failed reprocessing preserves messages in DLQ
    - **GREEN**: Create `src/contexts/platform/handlers/dlq-monitor.ts`: triggered by SNS (from CloudWatch alarm). Read DLQ messages (receive without delete). Publish `dlq.message-received` event to EventBridge with context. For ingestion DLQ: attempt reprocessing (re-publish to source Lambda) with exponential backoff, max 3 retries. Preserve failed messages in DLQ for manual investigation.
    - **REFACTOR**: Extract DLQ inspection logic into reusable utility; ensure reprocessing doesn't create infinite loops (track retry count in message attributes)
    - _Requirements: 14.4, 14.5_

  - [x] 13.8 Write unit tests for platform services (consolidation)
    - **RED**: Write edge-case tests: circuit breaker at exactly threshold boundary, degradation with multiple simultaneous failures, archival with oversized items (> 400KB DynamoDB limit already archived to S3), DLQ with thousands of messages, audit with audit system itself degraded
    - **GREEN**: Implement all edge-case test scenarios
    - **REFACTOR**: Ensure test coverage > 80%; validate all notification paths are exercised
    - _Requirements: 13.1-13.5, 14.3-14.6_

- [x] 14. Checkpoint — Full platform integration
  - Run all tests (`npm run test`). Run `terraform validate` on all modules. Ask the user if questions arise.


- [x] 15. Shadow Mode, Module Lifecycle, and Integration Testing
  - [x] 15.1 Implement shadow mode processing
    - **RED**: Write tests: (1) shadow mode module processes work items and generates proposals, (2) shadow mode NEVER executes changes, (3) records what actions would have been taken (confidence scores, execution plans), (4) shadow records retained for minimum 30 days, (5) integrates with module state from Dashboard context, (6) shadow mode module receives composed prompt including active skills/steering (validates intersection with prompt composition)
    - **GREEN**: Create `src/shared/shadow-mode.ts`: middleware that intercepts module execution and logs proposed actions without executing. Record: what actions would have been taken, confidence scores, execution plans. Retain shadow records for minimum 30 days. Integrate with module state from Dashboard context. Ensure shadow mode intercepts at execution boundary only — all upstream processing (including skills/steering prompt composition) runs normally.
    - **REFACTOR**: Ensure shadow mode is zero-cost when module is enabled (no interception overhead); validate retention TTL is configurable
    - _Requirements: 9.2, 9.3, 17.5_

  - [x] 15.2 Write integration tests for end-to-end event flow
    - **RED**: Write integration tests: (1) work-item.created → triage → research → planning → approval → execution → verification → documentation → work-item.resolved full flow, (2) circuit breaker trip → notification → human routing, (3) shadow mode: work items processed but not executed (including skills/steering composition), (4) degradation → recovery → notification clearing, (5) NL approve command from Teams/Slack reaches Orchestration and resumes execution (with identity attribution in audit), (6) plan.rejected event arriving between Supervisor dispatch and Execution start halts execution before first step (race condition validation)
    - **GREEN**: Implement all integration test scenarios using local event bus simulation
    - **REFACTOR**: Ensure integration tests are isolated (no shared state between tests); validate all event schemas are enforced in tests
    - _Requirements: 16.1, 16.4, 12.4, 5.2_

- [x] 16. POC Validation
  - [x] 16.1 Implement POC success validation suite
    - **RED**: Write validation tests: (1) script processes minimum 5 work items per category (account/service requests, routine health remediations, knowledge capture) through full end-to-end flow, (2) verifies minimum 3 runbooks were auto-generated, (3) verifies Transit Gateway routing with zero policy violations, (4) verifies timestamped audit entries exist at each stage transition for every processed item
    - **GREEN**: Create `scripts/poc-validation.ts`: seeds test work items (5+ per category) and runs them through complete flow (ingestion → research → proposal → approval → execution → documentation). Create `scripts/validate-runbooks.ts`: checks S3 runbook bucket for ≥3 generated runbooks, each with required fields. Create `scripts/validate-transit-gateway.ts`: verifies Transit Gateway routing compliance with zero policy violations. Validate audit trail completeness for all processed items.
    - **REFACTOR**: Ensure validation scripts are idempotent and can be re-run; add clear pass/fail output reporting
    - _Requirements: 16.1, 16.2, 16.4, 16.5_

  - [x] 16.2 Implement POC satisfaction survey collection
    - **RED**: Write tests: (1) survey form renders with accuracy, time savings, and usability dimensions (1-5 scale each), (2) submit stores response in DynamoDB with team member identity and timestamp, (3) validation script calculates average score across all responses, (4) validation fails if fewer than 2 responses or average < 4
    - **GREEN**: Create `src/contexts/dashboard/frontend/pages/SurveyPage.tsx`: simple form with three 1-5 Likert scales (accuracy, time savings, usability), optional free-text comments, team member identity (pre-filled from Cognito session). Create `src/contexts/dashboard/api/handlers/survey.ts`: POST /poc/survey (stores response), GET /poc/survey/results (aggregated scores). Create `scripts/validate-satisfaction.ts`: checks DynamoDB for ≥2 responses with average ≥4.
    - **REFACTOR**: Ensure survey page is accessible; validate that survey responses are immutable once submitted (append-only)
    - _Requirements: 16.3_

- [x] 17. Final Checkpoint — Full system validation
  - Run all tests (`npm run test`). Run `terraform validate` on all modules. Run POC validation scripts. Ask the user if questions arise.


## Notes

- Each task follows **Red/Green/Refactor** cycle for disciplined TDD
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties from the design document (Classification completeness, Confidence monotonicity, Plan boundedness, State machine validity, Circuit breaker determinism, Audit completeness)
- Unit tests validate specific examples and edge cases
- TypeScript is used throughout (Lambda handlers, domain logic, React frontend)
- All Terraform modules use `force_destroy = true` for POC teardown capability
- Contexts communicate exclusively via EventBridge events — no direct Lambda-to-Lambda calls
- Hexagonal architecture is used for Orchestration and Execution contexts; simple Lambda handlers for others
- RBAC uses `team_lead` and `team_member` roles (aligned with Requirement 13.3)
- `approval.decision` events can originate from both Dashboard and Communication contexts (per Req 12.4)
- Documentation Agent publishes `work-item.resolved` as the final pipeline step
- Module state includes `disabling` as a transitional state visible on Dashboard
- Skills & Steering docs are prompt-only documents (no dynamic tool registration) — team_lead managed via Dashboard
- Prompt composition fetches skills/steering at invocation time (pull model, immediate effect on update)
- Shadow mode intercepts at execution boundary only — all upstream processing (triage, research, planning, skills/steering composition) runs normally
- Sensitive data that cannot be redacted without losing resolution context is escalated to human operators (no on-prem LLM for POC)
- NL commands in Teams/Slack are authorized via identity mapping table (Teams/Slack ID → Cognito role)
- WebSocket connections implement heartbeat (30s) + automatic reconnection with exponential backoff
- DynamoDB → S3 archival via Streams ensures zero data loss during TTL-based expiry
- DLQ monitoring actively alerts on failed messages and attempts reprocessing for ingestion context
- Token budget API enables Dashboard to show per-agent context window consumption
- Planning Agent escalation is synchronous (immediate on confidence < 30); "within 5 minutes" is max SLA guarantee
- Three-tier notification escalation: Teams/Slack → SES email → Dashboard alert (`notification.failed` event)

## Alignment Changes Applied

The following changes were incorporated from the alignment review:

1. **Finding #1 (Important)**: Clarified sensitive data routing as human escalation for POC — added to Supervisor Agent (5.9) and ADR (3.4); updated Requirement 13.2
2. **Finding #2 (Minor)**: Added explicit `ModuleConfig` interface to design; updated OpenAPI spec task (3.2) to include validation ranges
3. **Finding #3 (Important)**: Added notification escalation architecture to design; added three-tier escalation to notification dispatcher task (11.2)
4. **Finding #4 (Important)**: Added NL authorization tests to task 11.5; added identity mapping task (11.4)
5. **Finding #5 (Minor)**: Added race condition integration test to task 15.2 (test case 6)
6. **Finding #6 (Minor)**: Added shadow mode + skills/steering interaction test to tasks 15.1 (test 6) and 12.4 (test 6)
7. **Finding #7 (Important)**: Added token budget API endpoint (10.2 test 8), token budget UI (10.6 test 9, 12.5 tests 6/9), and design interfaces
8. **Finding #8 (Minor)**: Added DynamoDB-to-S3 archival task (13.2) with DynamoDB Streams trigger
9. **Finding #9 (Important)**: Added identity mapping task (11.4) and design section with DynamoDB table schema
10. **Finding #10 (Minor)**: Added DLQ monitoring task (13.7) with reprocessing for ingestion context
11. **Finding #11 (Minor)**: Added WebSocket resilience to tasks 10.1, 10.5, 10.6 and design section
12. **Finding #12 (Minor)**: Added POC survey collection task (16.2) with Dashboard form and validation script
13. **Finding #13 (Minor)**: Added explicit escalation timer mechanism in design (Step Functions Choice state) and task 5.6 (test 8, synchronous escalation)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.4"] },
    { "id": 1, "tasks": ["1.2", "1.6", "3.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "3.2", "3.3"] },
    { "id": 3, "tasks": ["1.5", "4.1", "5.1", "7.1", "8.1", "10.1", "11.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "8.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5", "4.6", "5.3", "5.5", "5.6", "5.8", "5.13", "8.3"] },
    { "id": 6, "tasks": ["4.7", "5.4", "5.7", "5.9", "5.10", "8.4", "7.2", "7.3", "7.4"] },
    { "id": 7, "tasks": ["5.11", "5.12", "5.14", "8.5", "8.6", "8.7", "7.5", "13.1", "13.2", "13.4", "13.6", "13.7", "12.1", "12.6"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.5", "11.2", "11.3", "11.4", "11.5", "13.3", "13.5", "12.2", "12.3"] },
    { "id": 9, "tasks": ["10.4", "10.6", "10.7", "11.6", "13.8", "15.1", "12.4", "12.5", "12.7"] },
    { "id": 10, "tasks": ["15.2", "16.1", "16.2", "12.8"] }
  ]
}
```

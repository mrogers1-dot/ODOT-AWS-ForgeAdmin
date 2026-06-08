# Implementation Plan: ForgeAdmin Platform

## Overview

This plan implements the ForgeAdmin agentic multi-agent platform across 7 bounded contexts, following the architecture design's recommended build order: Platform/Infra foundation first, then Ingestion, Agent Orchestration, Knowledge Base, Execution Layer, Dashboard & API, and Communication. Each context deploys independently with its own Terraform state. TypeScript is used throughout for Lambda handlers and domain logic; React (TypeScript, Vite) for the dashboard frontend.

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

## Tasks

- [ ] 1. Platform Foundation & Shared Infrastructure
  - [ ] 1.1 Create monorepo directory structure and project configuration
    - Create top-level directory structure: `terraform/foundation/`, `terraform/contexts/{ingestion,orchestration,execution,knowledge-base,dashboard,communication,platform}/`, `terraform/scripts/`, `terraform/environments/`, `contracts/events/`, `contracts/api/`, `docs/adr/`, `src/shared/`
    - Initialize root `package.json` with TypeScript, Vitest, ESLint, fast-check dependencies
    - Create `tsconfig.json` with strict mode and path aliases
    - Create `.eslintrc.json` enforcing structured logging and consistent patterns
    - _Requirements: 15.1, 15.4_

  - [ ] 1.2 Create Terraform foundation module — EventBridge, networking, IAM
    - Create `terraform/foundation/main.tf` with AWS provider configuration
    - Create `terraform/foundation/eventbridge.tf`: custom event bus `forgeadmin-events`, Schema Registry
    - Create `terraform/foundation/networking.tf`: VPC, Transit Gateway attachments, security groups
    - Create `terraform/foundation/iam-shared.tf`: cross-context IAM roles, least-privilege policies
    - Create `terraform/foundation/cognito.tf`: User Pool with `admin` and `viewer` roles
    - Create `terraform/foundation/outputs.tf`: SSM parameters for EventBridge bus ARN, VPC ID, Cognito pool ID
    - Create `terraform/foundation/backend.tf`: S3 backend with key `forgeadmin/foundation/terraform.tfstate`
    - Create `terraform/foundation/variables.tf` and `terraform/environments/dev.tfvars`
    - _Requirements: 15.1, 15.2, 13.3_

  - [ ] 1.3 Create Terraform platform context — observability, audit trail, circuit breaker
    - Create `terraform/contexts/platform/main.tf` with S3 backend key `forgeadmin/platform/terraform.tfstate`
    - Create `terraform/contexts/platform/dynamodb.tf`: audit trail table (single-table design with GSIs: `actor-timestamp-index`, `context-action-index`), `force_destroy = true`
    - Create `terraform/contexts/platform/s3.tf`: storage bucket with lifecycle policies (90-day transition, Glacier after 1yr), `force_destroy = true`, versioning enabled
    - Create `terraform/contexts/platform/cloudwatch.tf`: dashboards (per-context + platform overview), alarms for DLQ depth, error rate thresholds
    - Create `terraform/contexts/platform/sns.tf`: alarm notification topics
    - SSM parameter lookups for foundation outputs
    - _Requirements: 13.1, 13.4, 13.5, 14.4, 9.1, 9.2_

  - [ ] 1.4 Create deployment scripts (deploy-all, destroy-all, destroy-context)
    - Create `terraform/scripts/deploy-all.sh`: deploys foundation first, then all contexts in parallel
    - Create `terraform/scripts/destroy-all.sh`: destroys all contexts in parallel, then foundation last
    - Create `terraform/scripts/destroy-context.sh`: accepts context name argument, destroys single context
    - All scripts must validate prerequisites (AWS CLI, Terraform installed) and handle errors
    - _Requirements: 15.1_

  - [ ] 1.5 Create GitHub Actions CI/CD pipeline
    - Create `.github/workflows/terraform-deploy.yml`: triggered on merge to main
    - Implement plan → validate → apply stages with 15-minute timeout
    - Add manual approval gate for resource destruction/replacement
    - Implement automatic rollback on failure (revert to last successful commit, re-apply)
    - Add Terraform fmt/validate checks on PR
    - Create `.github/workflows/pr-checks.yml`: lint, typecheck, unit tests, contract validation
    - _Requirements: 15.3, 15.5, 15.6_

  - [ ] 1.6 Implement shared observability utilities
    - Create `src/shared/logging.ts`: structured JSON logger with `correlationId`, `context`, `action`, `level` fields
    - Create `src/shared/tracing.ts`: X-Ray tracing initialization helper for Lambdas
    - Create `src/shared/metrics.ts`: CloudWatch custom metrics helper (invocation count, error count, duration percentiles)
    - Create `src/shared/types.ts`: shared TypeScript types (EventEnvelope, CorrelationContext)
    - _Requirements: 13.1, 14.5_

- [ ] 2. Checkpoint — Foundation validation
  - Ensure all Terraform validates successfully (`terraform validate` in each module), ask the user if questions arise.

- [ ] 3. Event Contracts & Documentation
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

  - [ ] 3.4 Create ADR documents and project documentation
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

- [ ] 4. Ingestion Context
  - [ ] 4.1 Create Ingestion Terraform module
    - Create `terraform/contexts/ingestion/main.tf` with S3 backend key `forgeadmin/ingestion/terraform.tfstate`
    - Create `terraform/contexts/ingestion/dynamodb.tf`: work items table with GSI `sourceSystem-originalId-index` for deduplication, `force_destroy = true`, on-demand capacity, PITR enabled
    - Create `terraform/contexts/ingestion/lambda.tf`: three Lambda functions (ServiceNow poller, SES handler, FortiSIEM webhook), EventBridge rule for scheduled polling
    - Create `terraform/contexts/ingestion/api-gateway.tf`: FortiSIEM webhook endpoint
    - Create `terraform/contexts/ingestion/ses.tf`: SES receipt rule for `servers@dot.ohio.gov`
    - Create `terraform/contexts/ingestion/iam.tf`: per-Lambda IAM roles with least-privilege
    - SSM lookups for EventBridge bus ARN
    - _Requirements: 1.1, 1.2, 1.3, 15.1, 15.2_

  - [ ] 4.2 Implement WorkItem normalizer and deduplication checker
    - Create `src/contexts/ingestion/normalizer.ts`: transforms ServiceNow, email, FortiSIEM payloads into common `WorkItem` interface
    - Create `src/contexts/ingestion/deduplication.ts`: DynamoDB lookup by `sourceSystem + originalId`, skip if exists, log duplicate detection
    - Create `src/contexts/ingestion/models.ts`: TypeScript interfaces for WorkItem, source-specific payloads
    - _Requirements: 1.4, 1.7_

  - [ ] 4.3 Implement ServiceNow poller Lambda
    - Create `src/contexts/ingestion/handlers/servicenow-poller.ts`: scheduled Lambda polling ServiceNow API
    - Implement polling logic with last-checked timestamp tracking
    - Integrate normalizer, deduplication checker, and EventBridge publishing (`work-item.created`)
    - Implement error handling: exponential backoff on failure, Teams/Slack notification after 3 consecutive failures
    - Apply structured logging with correlationId and X-Ray tracing
    - _Requirements: 1.1, 1.5_

  - [ ] 4.4 Implement SES email handler Lambda
    - Create `src/contexts/ingestion/handlers/ses-handler.ts`: triggered by SES receipt rule
    - Parse email extracting: sender address, subject line, received timestamp, body content
    - Handle unparseable emails: create work item with available fields, flag for manual review, notify Teams/Slack
    - Integrate normalizer, deduplication, EventBridge publishing
    - _Requirements: 1.2, 1.6_

  - [ ] 4.5 Implement FortiSIEM webhook Lambda
    - Create `src/contexts/ingestion/handlers/fortisiem-webhook.ts`: API Gateway triggered Lambda
    - Validate incoming webhook payload, normalize to WorkItem format
    - Integrate normalizer, deduplication, EventBridge publishing
    - Implement retry logic with exponential backoff capped at 5 minutes
    - _Requirements: 1.3, 1.5_

  - [ ] 4.6 Implement EventBridge event publisher for Ingestion
    - Create `src/contexts/ingestion/publisher.ts`: publishes `work-item.created` events conforming to EventEnvelope standard and JSON Schema contract
    - Validate events against schema before publishing
    - Include correlationId propagation
    - _Requirements: 1.4, 15.4_

  - [ ]* 4.7 Write unit tests for Ingestion context
    - Test normalizer with various ServiceNow, email, FortiSIEM payloads
    - Test deduplication logic (duplicate detected, new item)
    - Test error handling paths (unparseable email, source unavailable)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 5. Agent Orchestration Context
  - [ ] 5.1 Create Orchestration Terraform module
    - Create `terraform/contexts/orchestration/main.tf` with S3 backend key `forgeadmin/orchestration/terraform.tfstate`
    - Create `terraform/contexts/orchestration/dynamodb.tf`: orchestration table with GSIs (`status-createdAt-index`, `category-riskLevel-index`), `force_destroy = true`
    - Create `terraform/contexts/orchestration/step-functions.tf`: state machine definition for multi-agent flow (Triage → Research → Planning → Approval Gate → Execution → Verification → Documentation)
    - Create `terraform/contexts/orchestration/lambda.tf`: Lambda functions for each agent step + event handlers
    - Create `terraform/contexts/orchestration/iam.tf`: roles for Step Functions, Lambdas, Bedrock access
    - SSM lookups for EventBridge bus ARN, Cognito pool ID
    - _Requirements: 2.1, 3.1, 4.1, 7.1, 15.1, 15.2_

  - [ ] 5.2 Implement hexagonal architecture ports and domain models
    - Create `src/contexts/orchestration/domain/ports/IKnowledgeBase.ts`
    - Create `src/contexts/orchestration/domain/ports/IEventPublisher.ts`
    - Create `src/contexts/orchestration/domain/ports/IModelInvoker.ts`
    - Create `src/contexts/orchestration/domain/ports/IStateStore.ts`
    - Create `src/contexts/orchestration/domain/models/work-item.ts`: WorkItem entity with classification fields
    - Create `src/contexts/orchestration/domain/models/execution-plan.ts`: ExecutionPlan with steps, confidence score, justification
    - Create `src/contexts/orchestration/domain/models/confidence-score.ts`: ConfidenceScore value object with factor breakdown
    - Create `src/contexts/orchestration/domain/models/knowledge-item.ts`: KnowledgeItem with relevance scoring
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3_

  - [ ] 5.3 Implement Triage Agent domain logic
    - Create `src/contexts/orchestration/domain/agents/triage.ts`
    - Implement classification into exactly one category: account/service request, health remediation, security alert, knowledge capture
    - Implement risk level assignment: low (single-system, reversible), medium (multi-system, partially reversible), high (environment-wide, irreversible)
    - Implement urgency level assignment: critical (1hr SLA), high (4hr), normal (24hr), low (no SLA pressure)
    - Generate justification string referencing input attributes for each decision
    - Handle insufficient attributes: default high risk, high urgency, justification noting missing fields
    - Implement 30-second timeout handling: preserve partial results, default unassigned fields to high/critical
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 5.4 Write property tests for Triage Agent — Classification completeness
    - **Property 1: Classification completeness**
    - For any valid work item input, triage MUST produce exactly one category, one risk level, one urgency level
    - Use fast-check to generate arbitrary work item inputs and verify output structure invariants
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ] 5.5 Implement Research Agent domain logic
    - Create `src/contexts/orchestration/domain/agents/research.ts`
    - Query Knowledge Base using work item classification category and extracted keywords
    - Return ranked list of up to 10 items with relevance score (0.0-1.0), minimum threshold 0.3
    - Handle knowledge gap: flag item for runbook creation when no items meet threshold
    - Handle KB unavailability: notify requesting agent, flag item as lacking knowledge context
    - Implement 15-second completion timeout
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [ ] 5.6 Implement Planning Agent domain logic
    - Create `src/contexts/orchestration/domain/agents/planning.ts`
    - Generate execution plan: ordered steps (max 20) with description, expected outcome, rollback procedure
    - Calculate Confidence Score (0-100) with factor breakdown
    - Generate structured justification referencing at least one KB item by identifier
    - Link proposals to originating ServiceNow ticket
    - Implement confidence threshold escalation: if score < 30, escalate within 5 minutes with findings summary
    - Handle research timeout/problems: notify operator with ticket reference and issue nature
    - Cap confidence at 50 when KB unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 14.1_

  - [ ]* 5.7 Write property tests for Planning Agent — Confidence monotonicity and Plan boundedness
    - **Property 2: Confidence monotonicity** — Higher KB relevance scores produce higher confidence scores (given same inputs otherwise)
    - **Property 3: Plan boundedness** — Every generated plan has ≤20 steps; every step has rollback OR manual flag
    - Use fast-check to generate arbitrary research results and verify confidence ordering and plan constraints
    - **Validates: Requirements 4.1, 4.2**

  - [ ] 5.8 Implement Verification Agent domain logic
    - Create `src/contexts/orchestration/domain/agents/verification.ts`
    - Compare each step's actual outcome (exit code, state change, output) against expected outcome
    - Record pass/fail per step
    - Flag work item for human review on mismatch, notify Teams/Slack with details
    - Handle verification failure/timeout (60 seconds): flag for human review, notify channel
    - Update ServiceNow on all-pass: resolution details, verification results, timestamp
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 5.9 Implement Supervisor Agent and Step Functions wiring
    - Create `src/contexts/orchestration/domain/agents/supervisor.ts`: routes work items, manages approval gates, handles circuit breaker state
    - Implement approval routing: medium/high risk → Approval Gate; low risk + confidence > threshold → auto-execute
    - Implement SLA timer for approvals (default 30min, configurable 5min-24hr), reminder + escalation logic
    - Implement rejection handling: cancel action, notify module, retain in audit
    - Handle escalation timeout (third SLA period): auto-reject, log, notify all
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 5.10 Implement Orchestration adapters (Bedrock, EventBridge, DynamoDB, KB client)
    - Create `src/contexts/orchestration/adapters/bedrock-model.ts`: implements IModelInvoker using Bedrock API
    - Create `src/contexts/orchestration/adapters/eventbridge-publisher.ts`: implements IEventPublisher with schema validation
    - Create `src/contexts/orchestration/adapters/dynamodb-state.ts`: implements IStateStore with single-table design
    - Create `src/contexts/orchestration/adapters/knowledge-base-client.ts`: implements IKnowledgeBase calling KB context
    - _Requirements: 3.1, 4.1, 15.2_

  - [ ] 5.11 Implement Lambda handlers (thin wiring layer)
    - Create `src/contexts/orchestration/handlers/on-work-item-created.ts`: EventBridge trigger, starts Step Functions execution
    - Create `src/contexts/orchestration/handlers/on-execution-completed.ts`: EventBridge trigger, resumes verification step
    - Create `src/contexts/orchestration/handlers/step-function-tasks.ts`: individual task handlers wiring domain agents to adapters
    - Create `src/contexts/orchestration/handlers/on-approval-decision.ts`: callback token handler resuming Step Functions
    - _Requirements: 2.1, 7.1_

  - [ ]* 5.12 Write unit tests for Orchestration domain agents
    - Test triage classification with various input combinations
    - Test research ranking and knowledge gap detection
    - Test planning confidence calculation and step generation
    - Test verification pass/fail logic
    - Test supervisor routing decisions and SLA handling
    - _Requirements: 2.1-2.7, 3.1-3.6, 4.1-4.6, 5.1-5.7, 7.1-7.5_

- [ ] 6. Checkpoint — Ingestion and Orchestration validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Knowledge Base Context
  - [ ] 7.1 Create Knowledge Base Terraform module
    - Create `terraform/contexts/knowledge-base/main.tf` with S3 backend key `forgeadmin/knowledge-base/terraform.tfstate`
    - Create `terraform/contexts/knowledge-base/bedrock.tf`: Bedrock Knowledge Base configuration, data source (S3 bucket)
    - Create `terraform/contexts/knowledge-base/dynamodb.tf`: knowledge gap tracker table, `force_destroy = true`
    - Create `terraform/contexts/knowledge-base/s3.tf`: KB source documents bucket, runbooks bucket (versioned), `force_destroy = true`
    - Create `terraform/contexts/knowledge-base/lambda.tf`: query handler, runbook generator, KB updater Lambda functions
    - Create `terraform/contexts/knowledge-base/iam.tf`: Bedrock access, S3 read/write roles
    - _Requirements: 3.1, 8.1, 8.2, 15.1, 15.2_

  - [ ] 7.2 Implement KB query handler
    - Create `src/contexts/knowledge-base/handlers/query-handler.ts`: receives research queries, queries Bedrock KB
    - Implement relevance scoring (0.0-1.0), filter items below 0.3 threshold
    - Return ranked list of up to 10 knowledge items
    - Handle Bedrock KB unavailability gracefully
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [ ] 7.3 Implement runbook generator
    - Create `src/contexts/knowledge-base/handlers/runbook-generator.ts`: triggered by `work-item.resolved` events for knowledge gap items
    - Generate structured runbooks containing: title, applicable incident types, prerequisites, step-by-step procedure, expected outcomes, rollback steps
    - Store in S3 with versioning
    - Publish `runbook.generated` event
    - 10-minute soft timeout (continue if still processing)
    - _Requirements: 8.2, 8.3, 8.5_

  - [ ] 7.4 Implement KB updater
    - Create `src/contexts/knowledge-base/handlers/kb-updater.ts`: triggered by `execution.completed` and `verification.completed` events
    - Update KB with resolution steps, root cause, affected systems
    - Implement retry logic (3 attempts, 30-second intervals) on failure
    - Notify Teams/Slack channel on persistent failure
    - _Requirements: 3.5, 8.1, 8.6_

  - [ ]* 7.5 Write unit tests for Knowledge Base context
    - Test query handler relevance scoring and threshold filtering
    - Test runbook generator output structure validation
    - Test KB updater retry logic
    - _Requirements: 3.1-3.6, 8.1-8.6_

- [ ] 8. Execution Layer Context
  - [ ] 8.1 Create Execution Layer Terraform module
    - Create `terraform/contexts/execution/main.tf` with S3 backend key `forgeadmin/execution/terraform.tfstate`
    - Create `terraform/contexts/execution/sqs.tf`: execution queue (max concurrency=1), DLQ
    - Create `terraform/contexts/execution/dynamodb.tf`: execution state table with GSI `planId-index`, `force_destroy = true`
    - Create `terraform/contexts/execution/lambda.tf`: execution handler Lambda, callback handler Lambda
    - Create `terraform/contexts/execution/api-gateway.tf`: callback endpoint for jump server
    - Create `terraform/contexts/execution/secrets.tf`: Secrets Manager for mTLS certificates
    - Create `terraform/contexts/execution/iam.tf`: roles with Transit Gateway, Secrets Manager access
    - _Requirements: 6.1, 6.5, 15.1, 15.2_

  - [ ] 8.2 Implement hexagonal ports and execution bridge interface
    - Create `src/contexts/execution/domain/ports/IExecutionBridge.ts`: submitCommand, getStatus interfaces
    - Create `src/contexts/execution/domain/ports/IStateStore.ts`: execution state persistence
    - Create `src/contexts/execution/domain/ports/IEventPublisher.ts`
    - Create `src/contexts/execution/domain/models/execution-command.ts`: ExecutionCommand, ExecutionTicket, ExecutionStatus types
    - Create `src/contexts/execution/domain/models/execution-result.ts`: step results, verdicts
    - _Requirements: 6.1, 6.2_

  - [ ] 8.3 Implement execution orchestrator domain logic
    - Create `src/contexts/execution/domain/execution-orchestrator.ts`
    - Implement single-concurrency execution flow: receive plan → evaluate in MXC sandbox → execute via JEA → callback handling
    - Implement halt-always-on-failure: any step failure halts plan immediately
    - Implement rollback execution within 120 seconds on failure
    - Handle sandbox fail verdict: block command, halt plan, notify
    - Handle missing rollback: halt plan, preserve state, escalate for manual intervention
    - Handle blocked execution (approval revoked, module disabled, circuit breaker): halt and notify
    - 10-minute timeout: no callback = mark failed
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8_

  - [ ] 8.4 Implement execution adapters (mTLS bridge, DynamoDB, EventBridge)
    - Create `src/contexts/execution/adapters/mtls-bridge.ts`: implements IExecutionBridge, HTTPS communication via Transit Gateway with mTLS
    - Create `src/contexts/execution/adapters/dynamodb-state.ts`: implements IStateStore for execution state
    - Create `src/contexts/execution/adapters/eventbridge-publisher.ts`: publishes `execution.completed` and `execution.failed` events
    - Load mTLS certificates from Secrets Manager
    - _Requirements: 6.1, 6.5_

  - [ ] 8.5 Implement Lambda handlers for Execution context
    - Create `src/contexts/execution/handlers/sqs-handler.ts`: SQS trigger (max concurrency=1), wires orchestrator to adapters
    - Create `src/contexts/execution/handlers/callback-handler.ts`: API Gateway endpoint receiving jump server callbacks
    - Create `src/contexts/execution/handlers/timeout-handler.ts`: EventBridge scheduled rule checking for stale executions (10-min timeout)
    - _Requirements: 6.1, 6.4_

  - [ ]* 8.6 Write unit tests for Execution Layer
    - Test halt-on-failure logic
    - Test rollback execution path
    - Test sandbox fail verdict handling
    - Test timeout detection
    - Test single-concurrency enforcement
    - _Requirements: 6.1-6.8_

- [ ] 9. Checkpoint — Core pipeline validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Dashboard & API Context
  - [ ] 10.1 Create Dashboard Terraform module
    - Create `terraform/contexts/dashboard/main.tf` with S3 backend key `forgeadmin/dashboard/terraform.tfstate`
    - Create `terraform/contexts/dashboard/s3-cloudfront.tf`: S3 bucket for SPA, CloudFront distribution
    - Create `terraform/contexts/dashboard/api-gateway.tf`: REST API Gateway with Cognito authorizer, WebSocket API
    - Create `terraform/contexts/dashboard/dynamodb.tf`: module config and approvals table with GSIs (`state-index`, `approval-status-index`), `force_destroy = true`
    - Create `terraform/contexts/dashboard/lambda.tf`: API handler Lambdas, WebSocket connection handler
    - Create `terraform/contexts/dashboard/iam.tf`: API Gateway, Lambda, DynamoDB roles
    - _Requirements: 11.1, 11.5, 15.1, 15.2_

  - [ ] 10.2 Implement Dashboard API Lambda handlers
    - Create `src/contexts/dashboard/api/handlers/modules.ts`: GET /modules (list with state, confidence, last execution), PATCH /modules/:id/state, PATCH /modules/:id/config
    - Create `src/contexts/dashboard/api/handlers/approvals.ts`: GET /approvals/pending (with full context), POST /approvals/:id/decision (approve/reject with rationale)
    - Create `src/contexts/dashboard/api/handlers/executions.ts`: GET /executions (filterable by module, date, risk, outcome, 90-day history)
    - Create `src/contexts/dashboard/api/handlers/audit.ts`: GET /audit (filterable audit trail)
    - Implement RBAC middleware: admin (full access), viewer (read-only)
    - Implement request validation from OpenAPI spec
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ] 10.3 Implement module state management and promotion logic
    - Create `src/contexts/dashboard/domain/module-manager.ts`: state transitions (enabled/disabled/shadow), 300-second grace period on disable, force-stop after grace period
    - Create `src/contexts/dashboard/domain/promotion-manager.ts`: manual vs auto-suggest promotion, accuracy metrics calculation, evaluation window management
    - Publish `module.state-changed` events on transitions
    - Log promotion rejections, enforce 365-day retention for promotion history
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 10.4 Write property tests for module state management — State machine validity
    - **Property 4: State machine validity** — Only valid transitions occur (enabled↔disabled, enabled↔shadow, disabled↔shadow); concurrent operations don't corrupt state
    - Use fast-check to generate sequences of state transitions and verify invariants
    - **Validates: Requirements 9.1, 9.4, 9.5, 9.6**

  - [ ] 10.5 Implement WebSocket real-time updates
    - Create `src/contexts/dashboard/websocket/connection-handler.ts`: manage WebSocket connections in DynamoDB
    - Create `src/contexts/dashboard/websocket/event-fan.ts`: EventBridge → WebSocket fan-out for module state changes, approvals, execution events
    - Implement 5-second refresh guarantee for state changes
    - _Requirements: 11.1, 11.3_

  - [ ] 10.6 Implement React SPA frontend
    - Initialize Vite + React + TypeScript project in `src/contexts/dashboard/frontend/`
    - Create Zustand store with slices: modules, approvals, executions, audit, websocket
    - Implement module dashboard view: state, confidence scores, last execution, state toggle controls
    - Implement approval queue view: pending approvals with confidence, justification, plan, risk level, ticket link
    - Implement execution history view: filterable by module, date, risk, outcome (90-day history)
    - Implement module configuration view: confidence threshold (0-100), promotion strategy (manual/auto-suggest), evaluation window
    - Implement RBAC-aware UI: hide modification controls for viewer role
    - Auto-generate TypeScript types from OpenAPI spec
    - Integrate WebSocket for real-time updates
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 10.1, 10.5_

  - [ ]* 10.7 Write unit tests for Dashboard API and domain logic
    - Test RBAC enforcement (admin vs viewer access)
    - Test module state transitions and grace period logic
    - Test promotion strategy logic (manual vs auto-suggest)
    - Test approval workflow (approve, reject, SLA timeout)
    - _Requirements: 9.1-9.6, 10.1-10.6, 11.1-11.6_

- [ ] 11. Communication Context
  - [ ] 11.1 Create Communication Terraform module
    - Create `terraform/contexts/communication/main.tf` with S3 backend key `forgeadmin/communication/terraform.tfstate`
    - Create `terraform/contexts/communication/sqs.tf`: communication queue (rate limit isolation), DLQ
    - Create `terraform/contexts/communication/dynamodb.tf`: notification state table (30-day TTL), `force_destroy = true`
    - Create `terraform/contexts/communication/lambda.tf`: notification dispatcher, morning digest, NL command handler, escalation handler
    - Create `terraform/contexts/communication/eventbridge.tf`: scheduled rule for 7:00 AM ET morning digest, event rules for notification triggers
    - Create `terraform/contexts/communication/iam.tf`: Lambda roles with SQS, DynamoDB, EventBridge access
    - _Requirements: 12.1, 12.2, 15.1, 15.2_

  - [ ] 11.2 Implement notification dispatcher
    - Create `src/contexts/communication/handlers/notification-dispatcher.ts`: routes events to Teams/Slack within 30 seconds
    - Implement notification types: auto-executed actions, approval requests, execution failures, system alerts (circuit breaker, degradation, ingestion failures)
    - Implement retry logic: 3 attempts with exponential backoff on delivery failure
    - Implement escalation to alternative method (email/Dashboard alert) when 30-second or 60-second timing violated
    - Log failures in audit trail, display undelivered notifications on Dashboard
    - _Requirements: 12.1, 12.3, 12.5_

  - [ ] 11.3 Implement morning digest generator
    - Create `src/contexts/communication/handlers/morning-digest.ts`: scheduled at 7:00 AM Eastern
    - Compile overnight activity (7PM-7AM): activity summary, pending approvals with age, module health for all enabled modules, anomalies (circuit breaker trips, error rate breaches, agent failures, ingestion outages)
    - Format for Teams/Slack delivery
    - _Requirements: 12.2_

  - [ ] 11.4 Implement natural language command handler
    - Create `src/contexts/communication/handlers/nl-command-handler.ts`: processes Teams/Slack messages
    - Support status queries: module state, pending approvals, recent execution outcomes
    - Support commands: approve/reject pending proposals, toggle module state
    - Respond within 30 seconds of receiving message
    - _Requirements: 12.4_

  - [ ]* 11.5 Write unit tests for Communication context
    - Test notification routing and retry logic
    - Test morning digest compilation
    - Test NL command parsing and response generation
    - Test escalation paths
    - _Requirements: 12.1-12.5_

- [ ] 12. Platform Services — Audit Trail, Circuit Breaker, Degradation
  - [ ] 12.1 Implement audit trail service
    - Create `src/contexts/platform/handlers/audit-handler.ts`: EventBridge-triggered Lambda writing audit entries
    - Implement append-only DynamoDB writes within 5 seconds of action
    - Include: agent decisions, human approvals, execution commands, results, timestamps, ServiceNow ticket links
    - Implement S3 archival lifecycle (DynamoDB → S3 after 90 days)
    - Implement 365-day minimum retention
    - _Requirements: 13.1, 16.4_

  - [ ]* 12.2 Write property tests for audit trail — Audit completeness
    - **Property 6: Audit completeness** — Every state transition produces exactly one audit entry
    - Use fast-check to generate sequences of domain events and verify 1:1 mapping to audit entries
    - **Validates: Requirements 13.1, 16.4**

  - [ ] 12.3 Implement circuit breaker service
    - Create `src/contexts/platform/handlers/circuit-breaker.ts`: monitors module error rates
    - Trip circuit breaker when error rate exceeds threshold (default: 3 failures in rolling 15-minute window)
    - Halt all automated execution for affected module on trip
    - Route affected work items to human operators
    - Publish `circuit-breaker.tripped` event
    - Notify Teams/Slack within 60 seconds of trip
    - _Requirements: 13.4, 13.5_

  - [ ]* 12.4 Write property tests for circuit breaker — Circuit breaker determinism
    - **Property 5: Circuit breaker determinism** — After threshold failures, breaker ALWAYS trips; no auto-executions permitted after trip
    - Use fast-check to generate sequences of success/failure events and verify deterministic tripping behavior
    - **Validates: Requirements 13.4, 13.5**

  - [ ] 12.5 Implement graceful degradation service
    - Create `src/contexts/platform/handlers/degradation-monitor.ts`: monitors component health
    - Implement bulkhead isolation between modules (one module failure doesn't cascade)
    - On component failure: remove from pipeline after definitive failure (not preemptive), reroute to humans, continue with remaining agents
    - Display degradation notification within 30 seconds (Dashboard + Teams/Slack): component, start time, affected capabilities
    - On recovery: restore within 60 seconds, clear indicators, log recovery event with total duration
    - _Requirements: 14.3, 14.4, 14.5, 14.6_

  - [ ] 12.6 Implement sensitive data redaction
    - Create `src/shared/redaction.ts`: detect and redact credentials, API keys, tokens, PII (names, SSNs, emails, phone numbers), secrets (passwords, certificates) before LLM calls
    - Replace with redaction placeholders
    - Route to on-prem if redaction renders data unusable
    - _Requirements: 13.2_

  - [ ]* 12.7 Write unit tests for platform services
    - Test circuit breaker threshold logic and state transitions
    - Test degradation detection and recovery flow
    - Test redaction patterns for all sensitive data types
    - Test audit entry structure and timing
    - _Requirements: 13.1-13.5, 14.3-14.6_

- [ ] 13. Checkpoint — Full platform integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Shadow Mode, Module Lifecycle, and Reliability
  - [ ] 14.1 Implement shadow mode processing
    - Create `src/shared/shadow-mode.ts`: middleware that intercepts module execution and logs proposed actions without executing
    - Record: what actions would have been taken, confidence scores, execution plans
    - Retain shadow records for minimum 30 days
    - Integrate with module state from Dashboard context
    - _Requirements: 9.2, 9.3_

  - [ ] 14.2 Implement Transit Gateway connectivity monitoring and queue management
    - Create `src/contexts/execution/handlers/connectivity-monitor.ts`: monitors Transit Gateway connection health
    - Queue approved actions for max 60 minutes on connection loss
    - Retry connectivity at 30-second intervals
    - Notify operators within 60 seconds of connection loss
    - Escalate all queued items to human operators after 60-minute queue
    - _Requirements: 14.2_

  - [ ]* 14.3 Write integration tests for end-to-end event flow
    - Test work-item.created → triage → research → planning → approval → execution → verification → documentation flow
    - Test circuit breaker trip → notification → human routing
    - Test shadow mode: work items processed but not executed
    - Test degradation → recovery → notification clearing
    - _Requirements: 16.1, 16.4_

- [ ] 15. Final Checkpoint — Full system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties from the design document (Classification completeness, Confidence monotonicity, Plan boundedness, State machine validity, Circuit breaker determinism, Audit completeness)
- Unit tests validate specific examples and edge cases
- TypeScript is used throughout (Lambda handlers, domain logic, React frontend)
- All Terraform modules use `force_destroy = true` for POC teardown capability
- Contexts communicate exclusively via EventBridge events — no direct Lambda-to-Lambda calls
- Hexagonal architecture is used for Orchestration and Execution contexts; simple Lambda handlers for others

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.4"] },
    { "id": 1, "tasks": ["1.2", "1.6", "3.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "3.2", "3.3"] },
    { "id": 3, "tasks": ["1.5", "4.1", "5.1", "7.1", "8.1", "10.1", "11.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "8.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5", "4.6", "5.3", "5.5", "5.6", "5.8", "8.3"] },
    { "id": 6, "tasks": ["4.7", "5.4", "5.7", "5.9", "5.10", "8.4", "7.2", "7.3", "7.4"] },
    { "id": 7, "tasks": ["5.11", "5.12", "8.5", "8.6", "7.5", "12.1", "12.3", "12.5", "12.6"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.5", "11.2", "11.3", "11.4", "12.2", "12.4"] },
    { "id": 9, "tasks": ["10.4", "10.6", "10.7", "11.5", "12.7", "14.1", "14.2"] },
    { "id": 10, "tasks": ["14.3"] }
  ]
}
```

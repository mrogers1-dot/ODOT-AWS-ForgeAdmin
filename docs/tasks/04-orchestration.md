# Task Group 04: Agent Orchestration Context

**Bounded Context:** Agent Orchestration
**Internal Pattern:** Hexagonal (ports/adapters)
**Dependencies:** Task Group 01 (foundation), Task Group 02 (event schemas)
**Terraform State:** `forgeadmin/orchestration/terraform.tfstate`

---

## Tasks

- [ ] 5.1 Create Orchestration Terraform module
  - **RED**: Write a `terraform validate` check for the orchestration context module
  - **GREEN**: Create `terraform/contexts/orchestration/main.tf` with S3 backend key `forgeadmin/orchestration/terraform.tfstate`. Create `terraform/contexts/orchestration/dynamodb.tf`: orchestration table with GSIs (`status-createdAt-index`, `category-riskLevel-index`), DynamoDB Streams enabled, `force_destroy = true`. Create `terraform/contexts/orchestration/step-functions.tf`: state machine definition for multi-agent flow (Triage → Research → Planning → Confidence Check → Approval Gate → Execution → Verification → Documentation). Include Choice state after Planning: if confidence < 30, route to immediate escalation step. Create `terraform/contexts/orchestration/lambda.tf`: Lambda functions for each agent step + event handlers. Create `terraform/contexts/orchestration/iam.tf`: roles for Step Functions, Lambdas, Bedrock access. SSM lookups for EventBridge bus ARN, Cognito pool ID.
  - **REFACTOR**: Validate Step Functions ASL definition passes linting; ensure IAM roles follow least-privilege; verify Choice state condition is correct
  - _Requirements: 2.1, 3.1, 4.1, 4.5, 7.1, 15.1, 15.2_

- [ ] 5.2 Implement hexagonal architecture ports and domain models
  - **RED**: Write type-checking tests asserting all port interfaces compile and domain models enforce their constraints (e.g., ConfidenceScore 0-100, max 20 plan steps)
  - **GREEN**: Create `src/contexts/orchestration/domain/ports/IKnowledgeBase.ts`. Create `src/contexts/orchestration/domain/ports/IEventPublisher.ts`. Create `src/contexts/orchestration/domain/ports/IModelInvoker.ts`. Create `src/contexts/orchestration/domain/ports/IStateStore.ts`. Create `src/contexts/orchestration/domain/ports/IServiceNowClient.ts`. Create `src/contexts/orchestration/domain/ports/ISkillSteeringProvider.ts`. Create `src/contexts/orchestration/domain/models/work-item.ts`: WorkItem entity with classification fields. Create `src/contexts/orchestration/domain/models/execution-plan.ts`: ExecutionPlan with steps, confidence score, justification. Create `src/contexts/orchestration/domain/models/confidence-score.ts`: ConfidenceScore value object with factor breakdown. Create `src/contexts/orchestration/domain/models/knowledge-item.ts`: KnowledgeItem with relevance scoring.
  - **REFACTOR**: Ensure domain models are immutable (readonly properties); validate value object invariants are enforced in constructors
  - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3, 17.5_

- [ ] 5.3 Implement Triage Agent domain logic
  - **RED**: Write tests: (1) valid work item produces exactly one category, one risk level, one urgency level, (2) work item with missing attributes defaults to high risk/high urgency with justification noting missing fields, (3) classification completes within simulated 30-second timeout, (4) timeout preserves partial results and defaults unassigned fields, (5) justification references input attributes
  - **GREEN**: Create `src/contexts/orchestration/domain/agents/triage.ts`. Implement classification into exactly one category: account/service request, health remediation, security alert, knowledge capture. Implement risk level assignment: low (single-system, reversible), medium (multi-system, partially reversible), high (environment-wide, irreversible). Implement urgency level assignment: critical (1hr SLA), high (4hr), normal (24hr), low (no SLA pressure). Generate justification string referencing input attributes for each decision. Handle insufficient attributes: default high risk, high urgency, justification noting missing fields. Implement 30-second timeout handling: preserve partial results, default unassigned fields to high/critical.
  - **REFACTOR**: Extract classification rules into configurable rule sets; ensure justification generation is consistent
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 5.4 Write property tests for Triage Agent — Classification completeness
  - **RED**: Write fast-check property test: for any valid work item input, triage MUST produce exactly one category, one risk level, one urgency level
  - **GREEN**: Implement arbitrary generators for work item inputs; run property test and fix any violations
  - **REFACTOR**: Add shrinking for minimal failing case identification; ensure generators cover edge cases (empty strings, extreme values)
  - _Validates: Requirements 2.1, 2.2, 2.3_

- [ ] 5.5 Implement Research Agent domain logic
  - **RED**: Write tests: (1) query returns ranked items with relevance scores, (2) items below 0.3 threshold are filtered, (3) max 10 items returned, (4) no items above threshold flags knowledge gap, (5) KB unavailability returns failure notification with "KB unavailable" flag, (6) completes within 15 seconds
  - **GREEN**: Create `src/contexts/orchestration/domain/agents/research.ts`. Query Knowledge Base using work item classification category and extracted keywords. Return ranked list of up to 10 items with relevance score (0.0-1.0), minimum threshold 0.3. Handle knowledge gap: flag item for runbook creation when no items meet threshold. Handle KB unavailability: notify requesting agent, flag item as lacking knowledge context, append "KB unavailable" flag to results. Implement 15-second completion timeout.
  - **REFACTOR**: Extract relevance threshold to configuration; ensure ranking algorithm is stable (deterministic ordering for equal scores)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 14.1_

- [ ] 5.6 Implement Planning Agent domain logic
  - **RED**: Write tests: (1) generates plan with ordered steps ≤20, each with description/expected outcome/rollback, (2) calculates confidence 0-100 with factor breakdown, (3) justification references at least one KB item by ID, (4) links to ServiceNow ticket, (5) confidence < 30 triggers immediate escalation (within 5-minute SLA), (6) caps confidence at 50 when "KB unavailable" flag is present, (7) research timeout triggers operator notification, (8) escalation summary includes research attempted, gaps identified, and reason confidence threshold not met
  - **GREEN**: Create `src/contexts/orchestration/domain/agents/planning.ts`. Generate execution plan: ordered steps (max 20) with description, expected outcome, rollback procedure specifying target restoration state. Calculate Confidence Score (0-100) with factor breakdown. Cap confidence at 50 when KB unavailable flag is present in research results. Generate structured justification referencing at least one KB item by identifier. Link proposals to originating ServiceNow ticket. Implement confidence threshold escalation: if score < 30, escalate immediately with findings summary listing research attempted, gaps identified, and reason. Handle research timeout/problems: notify operator with ticket reference and issue nature.
  - **REFACTOR**: Extract confidence calculation into pure function with testable factor weights; ensure escalation path is clearly separated from happy path
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 14.1_

- [ ] 5.7 Write property tests for Planning Agent — Confidence monotonicity and Plan boundedness
  - **RED**: Write fast-check property tests: (1) higher KB relevance scores produce higher confidence scores (given same inputs otherwise), (2) every generated plan has ≤20 steps, (3) every step has rollback OR manual flag
  - **GREEN**: Implement arbitrary generators for research results; run property tests and fix any violations
  - **REFACTOR**: Ensure confidence monotonicity holds across edge cases; add generators for boundary conditions
  - _Validates: Requirements 4.1, 4.2_

- [ ] 5.8 Implement Verification Agent domain logic
  - **RED**: Write tests: (1) all steps matching expected outcome → pass, (2) any mismatch → flag for human review + notify Teams/Slack, (3) verification failure/timeout (60s) → flag + notify, (4) all-pass updates ServiceNow with resolution details, (5) verification at exactly 60 seconds is treated as success
  - **GREEN**: Create `src/contexts/orchestration/domain/agents/verification.ts`. Compare each step's actual outcome against expected outcome. Record pass/fail per step. Flag work item for human review on mismatch, notify Teams/Slack with details. Handle verification failure/timeout (60 seconds): flag for human review, notify channel. Update ServiceNow on all-pass: resolution details, verification results, timestamp.
  - **REFACTOR**: Extract outcome comparison into strategy pattern (exit code vs state vs output); ensure notification payload is consistent
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 5.9 Implement Supervisor Agent and Step Functions wiring
  - **RED**: Write tests: (1) medium/high risk routes to Approval Gate, (2) low risk + confidence > threshold auto-executes with notification, (3) re-checks approval status before dispatching to Execution queue — if rejected, cancels, (4) SLA timer sends reminder after first period, escalates after second, (5) rejection cancels action and notifies module, (6) third SLA timeout auto-rejects, (7) definitive agent failure removes agent from pipeline, reroutes to humans, publishes degradation event, (8) sensitive data detected and unusable after redaction escalates to human operator without LLM processing
  - **GREEN**: Create `src/contexts/orchestration/domain/agents/supervisor.ts`: routes work items, manages approval gates, handles circuit breaker state, handles agent failure degradation, handles sensitive data escalation. Implement approval routing: medium/high risk → Approval Gate; low risk + confidence > threshold → auto-execute. Implement cancellation check: before dispatching to Execution queue, re-check approval status; if rejected during race condition, cancel immediately. Implement SLA timer for approvals (default 30min, configurable 5min-24hr), reminder + escalation logic. Implement rejection handling: cancel action, notify module, retain in audit. Handle escalation timeout (third SLA period): auto-reject, log, notify all. Implement agent failure handling: detect definitive failure, remove from Step Functions flow, reroute affected work items to human operators, publish degradation event. Implement sensitive data escalation: if redaction renders data unusable, escalate to human operator, log reason in audit trail, notify Teams/Slack.
  - **REFACTOR**: Extract SLA/escalation logic into separate timer service; ensure cancellation check is atomic (no TOCTOU race)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 13.2, 14.3_

- [ ] 5.10 Implement Orchestration adapters (Bedrock, EventBridge, DynamoDB, KB client, ServiceNow)
  - **RED**: Write integration tests: (1) Bedrock adapter returns model response in expected format, (2) EventBridge adapter validates event before publish, (3) DynamoDB adapter round-trips work item correctly, (4) KB client handles unavailability gracefully, (5) ServiceNow client attaches work notes
  - **GREEN**: Create `src/contexts/orchestration/adapters/bedrock-model.ts`: implements IModelInvoker using Bedrock API. Create `src/contexts/orchestration/adapters/eventbridge-publisher.ts`: implements IEventPublisher with schema validation. Create `src/contexts/orchestration/adapters/dynamodb-state.ts`: implements IStateStore with single-table design. Create `src/contexts/orchestration/adapters/knowledge-base-client.ts`: implements IKnowledgeBase calling KB context. Create `src/contexts/orchestration/adapters/servicenow-client.ts`: implements IServiceNowClient for ticket updates.
  - **REFACTOR**: Extract common adapter patterns (error handling, retries) into base class; ensure all adapters handle timeouts gracefully
  - _Requirements: 3.1, 4.1, 15.2_

- [ ] 5.11 Implement Lambda handlers (thin wiring layer)
  - **RED**: Write tests: (1) on-work-item-created handler starts Step Functions execution with correct input, (2) on-execution-completed handler resumes verification step, (3) on-approval-decision handler resumes Step Functions with correct callback, (4) invalid event payloads are sent to DLQ
  - **GREEN**: Create `src/contexts/orchestration/handlers/on-work-item-created.ts`: EventBridge trigger, starts Step Functions execution. Create `src/contexts/orchestration/handlers/on-execution-completed.ts`: EventBridge trigger, resumes verification step. Create `src/contexts/orchestration/handlers/step-function-tasks.ts`: individual task handlers wiring domain agents to adapters. Create `src/contexts/orchestration/handlers/on-approval-decision.ts`: callback token handler resuming Step Functions.
  - **REFACTOR**: Ensure all handlers follow consistent error handling pattern; validate correlation ID propagation through all paths
  - _Requirements: 2.1, 7.1_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 5.1 | 3 |
| 5.2 | 4 |
| 5.3, 5.5, 5.6, 5.8 | 5 |
| 5.4, 5.7, 5.9, 5.10 | 6 |
| 5.11 | 7 |

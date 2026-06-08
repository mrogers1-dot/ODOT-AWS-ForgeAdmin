# Task Group 04: Agent Orchestration Context

**Bounded Context:** Agent Orchestration
**Internal Pattern:** Hexagonal (ports/adapters)
**Dependencies:** Task Group 01 (foundation), Task Group 02 (event schemas)
**Terraform State:** `forgeadmin/orchestration/terraform.tfstate`

---

## Tasks

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

---

## Wave Assignment

| Task | Wave |
|------|------|
| 5.1 | 3 |
| 5.2 | 4 |
| 5.3, 5.5, 5.6, 5.8 | 5 |
| 5.4, 5.7, 5.9, 5.10 | 6 |
| 5.11, 5.12 | 7 |

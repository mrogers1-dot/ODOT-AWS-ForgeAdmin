# Task Group 06: Execution Layer Context

**Bounded Context:** Execution Layer
**Internal Pattern:** Hexagonal (ports/adapters)
**Dependencies:** Task Group 01 (foundation, Transit Gateway), Task Group 04 (orchestration publishes `plan.approved`)
**Terraform State:** `forgeadmin/execution/terraform.tfstate`
**Special:** Requires on-prem jump server setup (mTLS, JEA endpoints, MXC sandbox)

---

## Tasks

- [ ] 8.1 Create Execution Layer Terraform module
  - **RED**: Write a `terraform validate` check for the execution context module
  - **GREEN**: Create `terraform/contexts/execution/main.tf` with S3 backend key `forgeadmin/execution/terraform.tfstate`. Create `terraform/contexts/execution/sqs.tf`: execution queue (max concurrency=1), DLQ. Create `terraform/contexts/execution/dynamodb.tf`: execution state table with GSI `planId-index`, `force_destroy = true`. Create `terraform/contexts/execution/lambda.tf`: execution handler Lambda, callback handler Lambda. Create `terraform/contexts/execution/api-gateway.tf`: callback endpoint for jump server. Create `terraform/contexts/execution/secrets.tf`: Secrets Manager for mTLS certificates. Create `terraform/contexts/execution/iam.tf`: roles with Transit Gateway, Secrets Manager access.
  - **REFACTOR**: Validate IAM policies are minimal; ensure SQS concurrency settings are correct
  - _Requirements: 6.1, 6.5, 15.1, 15.2_

- [ ] 8.2 Implement hexagonal ports and execution bridge interface
  - **RED**: Write type-checking tests asserting all port interfaces compile and model constraints hold (e.g., ExecutionTicket requires planId, ExecutionStatus enum is exhaustive)
  - **GREEN**: Create `src/contexts/execution/domain/ports/IExecutionBridge.ts`: submitCommand, getStatus interfaces. Create `src/contexts/execution/domain/ports/IStateStore.ts`: execution state persistence. Create `src/contexts/execution/domain/ports/IEventPublisher.ts`. Create `src/contexts/execution/domain/models/execution-command.ts`: ExecutionCommand, ExecutionTicket, ExecutionStatus types. Create `src/contexts/execution/domain/models/execution-result.ts`: step results, verdicts.
  - **REFACTOR**: Ensure models are immutable; validate enum completeness
  - _Requirements: 6.1, 6.2_

- [ ] 8.3 Implement execution orchestrator domain logic
  - **RED**: Write tests: (1) successful plan executes all steps in order, (2) any step failure halts plan immediately, (3) rollback executes within 120 seconds on failure, (4) sandbox fail verdict blocks command and halts plan, (5) missing rollback halts plan and escalates for manual intervention, (6) blocked execution (approval revoked, module disabled, circuit breaker) halts and notifies, (7) 10-minute timeout with no callback marks failed
  - **GREEN**: Create `src/contexts/execution/domain/execution-orchestrator.ts`. Implement single-concurrency execution flow: receive plan → evaluate in MXC sandbox → execute via JEA → callback handling. Implement halt-always-on-failure: any step failure halts plan immediately. Implement rollback execution within 120 seconds on failure. Handle sandbox fail verdict: block command, halt plan, notify. Handle missing rollback: halt plan, preserve state, escalate for manual intervention. Handle blocked execution (approval revoked, module disabled, circuit breaker): halt and notify. 10-minute timeout: no callback = mark failed.
  - **REFACTOR**: Extract timeout handling into reusable pattern; ensure state transitions are atomic
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8_

- [ ] 8.4 Implement execution adapters (mTLS bridge, DynamoDB, EventBridge)
  - **RED**: Write tests: (1) mTLS bridge submits command with correct certificate, (2) DynamoDB adapter round-trips execution state correctly, (3) EventBridge adapter publishes `execution.completed` and `execution.failed` events with valid schema, (4) connection failure returns error result (not exception), (5) Secrets Manager certificate loading works
  - **GREEN**: Create `src/contexts/execution/adapters/mtls-bridge.ts`: implements IExecutionBridge, HTTPS communication via Transit Gateway with mTLS. Create `src/contexts/execution/adapters/dynamodb-state.ts`: implements IStateStore for execution state. Create `src/contexts/execution/adapters/eventbridge-publisher.ts`: publishes `execution.completed` and `execution.failed` events. Load mTLS certificates from Secrets Manager.
  - **REFACTOR**: Extract certificate caching for warm Lambda starts; ensure connection pooling
  - _Requirements: 6.1, 6.5_

- [ ] 8.5 Implement Lambda handlers for Execution context
  - **RED**: Write tests: (1) SQS handler invokes orchestrator with correct plan, (2) callback handler resumes correct execution with result, (3) timeout handler detects stale executions older than 10 minutes, (4) concurrent SQS messages are rejected (max concurrency=1)
  - **GREEN**: Create `src/contexts/execution/handlers/sqs-handler.ts`: SQS trigger (max concurrency=1), wires orchestrator to adapters. Create `src/contexts/execution/handlers/callback-handler.ts`: API Gateway endpoint receiving jump server callbacks. Create `src/contexts/execution/handlers/timeout-handler.ts`: EventBridge scheduled rule checking for stale executions (10-min timeout).
  - **REFACTOR**: Ensure idempotent callback handling; validate correlation ID propagation
  - _Requirements: 6.1, 6.4_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 8.1 | 3 |
| 8.2 | 4 |
| 8.3 | 5 |
| 8.4, 8.5 | 6 |

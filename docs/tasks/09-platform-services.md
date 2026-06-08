# Task Group 09: Platform Services — Audit, Circuit Breaker, Degradation, Redaction

**Bounded Context:** Platform/Infra (runtime services)
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (infrastructure deployed)
**Terraform State:** `forgeadmin/platform/terraform.tfstate` (shared with 01)

---

## Tasks

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
  - Implement bulkhead isolation between modules
  - On component failure: remove from pipeline after definitive failure, reroute to humans, continue with remaining agents
  - Display degradation notification within 30 seconds (Dashboard + Teams/Slack)
  - On recovery: restore within 60 seconds, clear indicators, log recovery event with total duration
  - _Requirements: 14.3, 14.4, 14.5, 14.6_

- [ ] 12.6 Implement sensitive data redaction
  - Create `src/shared/redaction.ts`: detect and redact credentials, API keys, tokens, PII, secrets before LLM calls
  - Replace with redaction placeholders
  - Route to on-prem if redaction renders data unusable
  - _Requirements: 13.2_

- [ ]* 12.7 Write unit tests for platform services
  - Test circuit breaker threshold logic and state transitions
  - Test degradation detection and recovery flow
  - Test redaction patterns for all sensitive data types
  - Test audit entry structure and timing
  - _Requirements: 13.1-13.5, 14.3-14.6_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 12.1, 12.3, 12.5, 12.6 | 7 |
| 12.2, 12.4 | 8 |
| 12.7 | 9 |

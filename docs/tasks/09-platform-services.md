# Task Group 09: Platform Services — Audit, Circuit Breaker, Degradation, Redaction

**Bounded Context:** Platform/Infra (runtime services)
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (infrastructure deployed)
**Terraform State:** `forgeadmin/platform/terraform.tfstate` (shared with 01)

---

## Tasks

- [ ] 12.1 Implement audit trail service
  - **RED**: Write tests: (1) event produces audit entry in DynamoDB within 5 seconds, (2) entry includes agent decisions, human approvals, execution commands, timestamps, ServiceNow ticket links, (3) entries are append-only (no updates), (4) entries older than 90 days trigger S3 archival, (5) entries are retained for minimum 365 days
  - **GREEN**: Create `src/contexts/platform/handlers/audit-handler.ts`: EventBridge-triggered Lambda writing audit entries. Implement append-only DynamoDB writes within 5 seconds of action. Include: agent decisions, human approvals, execution commands, results, timestamps, ServiceNow ticket links. Implement S3 archival lifecycle (DynamoDB → S3 after 90 days). Implement 365-day minimum retention.
  - **REFACTOR**: Extract audit entry builder into reusable utility; ensure archival process is idempotent
  - _Requirements: 13.1, 16.4_

- [ ] 12.2 Write property tests for audit trail — Audit completeness
  - **RED**: Write fast-check property test: Every state transition produces exactly one audit entry
  - **GREEN**: Implement generators for domain event sequences; verify 1:1 mapping to audit entries
  - **REFACTOR**: Add generators for concurrent events; ensure no duplicate entries
  - _Validates: Requirements 13.1, 16.4_

- [ ] 12.3 Implement circuit breaker service
  - **RED**: Write tests: (1) error rate below threshold keeps circuit closed, (2) error rate exceeding threshold (3 failures in 15-min window) trips circuit, (3) tripped circuit halts all automated execution for module, (4) tripped circuit routes work items to humans, (5) `circuit-breaker.tripped` event is published, (6) Teams/Slack notification within 60 seconds of trip
  - **GREEN**: Create `src/contexts/platform/handlers/circuit-breaker.ts`: monitors module error rates. Trip circuit breaker when error rate exceeds threshold (default: 3 failures in rolling 15-minute window). Halt all automated execution for affected module on trip. Route affected work items to human operators. Publish `circuit-breaker.tripped` event. Notify Teams/Slack within 60 seconds of trip.
  - **REFACTOR**: Extract threshold configuration; ensure rolling window calculation is correct at boundaries
  - _Requirements: 13.4, 13.5_

- [ ] 12.4 Write property tests for circuit breaker — Circuit breaker determinism
  - **RED**: Write fast-check property test: After threshold failures, breaker ALWAYS trips; no auto-executions permitted after trip
  - **GREEN**: Implement generators for success/failure event sequences; verify deterministic tripping behavior
  - **REFACTOR**: Add edge case generators (rapid-fire events, exactly-at-threshold); validate window boundary behavior
  - _Validates: Requirements 13.4, 13.5_

- [ ] 12.5 Implement graceful degradation service
  - **RED**: Write tests: (1) component failure detection triggers degradation mode, (2) bulkhead isolation prevents cascade to other modules, (3) failed component is removed from pipeline and items reroute to humans, (4) degradation notification appears within 30 seconds, (5) recovery restores component within 60 seconds, (6) recovery clears degradation indicators, (7) recovery event logs total duration
  - **GREEN**: Create `src/contexts/platform/handlers/degradation-monitor.ts`: monitors component health. Implement bulkhead isolation between modules. On component failure: remove from pipeline after definitive failure, reroute to humans, continue with remaining agents. Display degradation notification within 30 seconds (Dashboard + Teams/Slack). On recovery: restore within 60 seconds, clear indicators, log recovery event with total duration.
  - **REFACTOR**: Extract health check strategy into configurable pattern; ensure recovery detection is reliable
  - _Requirements: 14.3, 14.4, 14.5, 14.6_

- [ ] 12.6 Implement sensitive data redaction
  - **RED**: Write tests: (1) credentials are detected and replaced with placeholder, (2) API keys are redacted, (3) tokens are redacted, (4) PII (SSN, email, phone) is redacted, (5) redaction that renders data unusable flags for human escalation, (6) non-sensitive data passes through unchanged
  - **GREEN**: Create `src/shared/redaction.ts`: detect and redact credentials, API keys, tokens, PII, secrets before LLM calls. Replace with redaction placeholders. Route to human operator if redaction renders data unusable.
  - **REFACTOR**: Ensure regex patterns are exhaustive; extract sensitive data patterns into configurable list
  - _Requirements: 13.2_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 12.1, 12.3, 12.5, 12.6 | 7 |
| 12.2, 12.4 | 8 |

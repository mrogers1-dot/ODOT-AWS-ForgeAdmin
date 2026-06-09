# Task Group 10: Shadow Mode, Module Lifecycle, Reliability & Integration Tests

**Bounded Context:** Cross-cutting
**Dependencies:** All previous task groups (full platform operational)
**Purpose:** Final integration layer connecting all contexts + E2E validation

---

## Tasks

- [x] 14.1 Implement shadow mode processing
  - **RED**: Write tests: (1) shadow mode intercepts execution and logs proposed actions WITHOUT executing, (2) shadow records include confidence scores, execution plans, and proposed actions, (3) shadow records are retained for minimum 30 days, (4) module in shadow state only produces shadow records (no real execution), (5) shadow mode integrates with module state from Dashboard
  - **GREEN**: Create `src/shared/shadow-mode.ts`: middleware that intercepts module execution and logs proposed actions without executing. Record: what actions would have been taken, confidence scores, execution plans. Retain shadow records for minimum 30 days. Integrate with module state from Dashboard context.
  - **REFACTOR**: Ensure shadow mode has zero side effects on production paths; extract retention policy to configuration
  - _Requirements: 9.2, 9.3_

- [x] 14.2 Implement Transit Gateway connectivity monitoring and queue management
  - **RED**: Write tests: (1) healthy connection reports ok status, (2) connection loss detected within 60 seconds, (3) approved actions queue for max 60 minutes on connection loss, (4) retry connectivity at 30-second intervals, (5) operator notification within 60 seconds of loss, (6) after 60-minute queue timeout all items escalate to humans
  - **GREEN**: Create `src/contexts/execution/handlers/connectivity-monitor.ts`: monitors Transit Gateway connection health. Queue approved actions for max 60 minutes on connection loss. Retry connectivity at 30-second intervals. Notify operators within 60 seconds of connection loss. Escalate all queued items to human operators after 60-minute queue.
  - **REFACTOR**: Extract queue management into reusable pattern; ensure timer accuracy
  - _Requirements: 14.2_

- [x] 14.3 Write integration tests for end-to-end event flow
  - **RED**: Write integration tests: (1) work-item.created → triage → research → planning → approval → execution → verification → documentation full flow, (2) circuit breaker trip → notification → human routing, (3) shadow mode: work items processed but not executed, (4) degradation → recovery → notification clearing, (5) plan.rejected during race condition halts execution
  - **GREEN**: Implement test infrastructure (localstack or mocked EventBridge), wire up all contexts, run flows end-to-end
  - **REFACTOR**: Extract test helpers; ensure tests are deterministic and repeatable
  - _Requirements: 16.1, 16.4_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 14.1, 14.2 | 9 |
| 14.3 | 10 |

---

## Final Checkpoint

- [x] All unit tests pass
- [x] All property-based tests pass
- [x] All integration tests pass
- [x] `terraform validate` succeeds for all modules
- [x] `deploy-all.sh` completes without errors
- [x] `destroy-all.sh` completes without errors (full teardown)
- [x] `deploy-all.sh` re-deploys cleanly after full teardown

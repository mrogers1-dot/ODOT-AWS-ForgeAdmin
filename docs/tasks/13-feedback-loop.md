# Task Group 13: Feedback Loop & Continuous Learning

**Bounded Context:** Knowledge Base (storage) + Orchestration (aggregation + consumption)
**Internal Pattern:** Simple Lambda handlers + scheduled aggregation
**Dependencies:** Task Group 01 (foundation), Task Group 04 (Orchestration agents), Task Group 05 (KB infrastructure), Task Group 06 (Execution publishes outcome events)
**Design Spec:** `docs/superpowers/specs/2026-06-08-feedback-loop-continuous-learning-design.md`

---

## Tasks

- [x] 14.1 Add feedback infrastructure to Knowledge Base Terraform module
  - Modify `terraform/contexts/knowledge-base/dynamodb.tf`: add `feedback-index` table with GSIs (`category-timestamp-index`, `module-signal-index`), `force_destroy = true`, on-demand capacity
  - Modify `terraform/contexts/knowledge-base/s3.tf`: add lifecycle rule for `feedback/` prefix path in existing storage bucket
  - Modify `terraform/contexts/knowledge-base/lambda.tf`: add `feedback-capture-handler` Lambda function
  - Modify `terraform/contexts/knowledge-base/eventbridge.tf`: add rules subscribing to `approval.decision`, `execution.completed`, `execution.failed`, `verification.completed` events
  - Modify `terraform/contexts/knowledge-base/iam.tf`: permissions for feedback-capture Lambda (DynamoDB write, S3 write, EventBridge)
  - Modify `terraform/contexts/knowledge-base/bedrock.tf`: add new data source pointing to `feedback/` S3 prefix for RAG retrieval
  - _Design Spec: Sections 3.3, 3.4, 7.1_

- [x] 14.2 Add feedback aggregation infrastructure to Orchestration Terraform module
  - Modify `terraform/contexts/orchestration/dynamodb.tf`: add `feedback-summaries` table (no GSIs needed, single-item lookups by PK), `force_destroy = true`
  - Modify `terraform/contexts/orchestration/lambda.tf`: add `feedback-aggregator` Lambda function
  - Modify `terraform/contexts/orchestration/eventbridge.tf`: add EventBridge Scheduler rule (hourly) triggering `feedback-aggregator`
  - Modify `terraform/contexts/orchestration/iam.tf`: aggregator Lambda needs cross-context read access to KB's `feedback-index` DynamoDB table (via SSM lookup for table ARN)
  - _Design Spec: Sections 4.4, 7.2_

- [x] 14.3 Define event schemas for feedback system
  - Create `contracts/events/knowledge-base/feedback.captured.schema.json`: feedback entry captured (id, workItemId, planId, signal, outcomeType, category, module, riskLevel, confidenceAtDecision)
  - Create `contracts/events/orchestration/feedback.summary-updated.schema.json`: aggregation run completed (summariesUpdated, timestamp)
  - Validate schemas conform to EventEnvelope standard
  - Register schemas in EventBridge Schema Registry
  - _Design Spec: Sections 7.3_

- [x] 14.4 Implement feedback capture domain models
  - Create `src/contexts/knowledge-base/domain/models/feedback-entry.ts`: FeedbackEntry interface with all fields (id, workItemId, planId, timestamp, category, riskLevel, module, tags, signal, outcomeType, confidenceAtDecision, planStepCount, kbItemsUsed, rejectionReason, operatorNotes, failureDetail)
  - Create `src/contexts/knowledge-base/domain/models/feedback-mappers.ts`: functions to map each event type (approval.decision, execution.completed, execution.failed, verification.completed) to a FeedbackEntry
  - _Design Spec: Sections 3.1, 3.2_

- [x] 14.5 Implement feedback capture handler
  - **RED**: Write tests: (1) approval.decision event maps to correct FeedbackEntry, (2) execution.completed maps correctly, (3) execution.failed maps correctly, (4) verification.completed maps correctly, (5) feedback document written to S3 with correct path, (6) index entry written to DynamoDB, (7) mapping failure goes to DLQ (never blocks execution)
  - **GREEN**: Create `src/contexts/knowledge-base/handlers/feedback-capture-handler.ts`: EventBridge triggered Lambda. Map incoming event to FeedbackEntry. Write to S3 and DynamoDB index. Publish `feedback.captured` event. Handle mapping failures gracefully.
  - **REFACTOR**: Ensure mapper is pure function; validate S3 path structure is consistent
  - _Design Spec: Sections 3.2, 3.3, 6_

- [x] 14.6 Implement feedback aggregation domain models
  - Create `src/contexts/orchestration/domain/models/feedback-summary.ts`: FeedbackSummary interface with stats (totalPlans, successRate, approvalRate, averageConfidence, confidenceAccuracy, recentTrend), guardrails (confidenceCeiling, confidenceFloor, requiresHumanReview, reason), commonFailures, successPatterns
  - Create `src/contexts/orchestration/domain/models/guardrail-rules.ts`: guardrail derivation logic — threshold conditions mapping to ceiling/floor/review values (5 consecutive failures → ceiling 40; success rate < 30% → ceiling 50; etc.)
  - _Design Spec: Sections 4.2, 4.3_

- [x] 14.7 Implement feedback aggregator Lambda
  - **RED**: Write tests: (1) aggregator computes success rate correctly, (2) trend detection compares last 10 vs prior 10 entries, (3) guardrails derived correctly (5 consecutive failures → ceiling 40), (4) partial bucket failure continues with others, (5) 3 consecutive full-run failures triggers alert, (6) summary is written to DynamoDB, (7) `feedback.summary-updated` event published
  - **GREEN**: Create `src/contexts/orchestration/handlers/feedback-aggregator.ts`: scheduled Lambda (hourly). Query feedback-index by bucket. Compute stats, derive guardrails, identify patterns. Write summaries. Publish event. Handle partial failures.
  - **REFACTOR**: Extract bucket computation into pure functions; ensure idempotent on re-run
  - _Design Spec: Sections 4.1, 4.3, 6_

- [x] 14.8 Implement IFeedbackProvider port and adapter
  - Create `src/contexts/orchestration/domain/ports/IFeedbackProvider.ts`: interface with `getSummary(category, module, riskLevel)` and `queryFeedbackHistory(query, limit)`
  - Create `src/contexts/orchestration/adapters/feedback-provider.ts`: implements IFeedbackProvider
    - `getSummary`: DynamoDB get-item from `feedback-summaries` table by composite PK
    - `queryFeedbackHistory`: queries Bedrock KB feedback data source for RAG retrieval (5-second timeout)
  - Handle unavailability: return null from getSummary, empty array from queryFeedbackHistory — never throw
  - _Design Spec: Sections 5.2, 6_

- [x] 14.9 Modify Planning agent to integrate feedback context
  - **RED**: Write tests: (1) planning calls IFeedbackProvider.getSummary() with correct params, (2) feedback stats are injected into planning prompt, (3) guardrail ceiling caps confidence, (4) guardrail floor boosts confidence, (5) requiresHumanReview flag forces approval gate, (6) novel situation triggers RAG fallback, (7) Steering doc override wins over computed guardrail, (8) ConfidenceAuditEntry is logged with all fields
  - **GREEN**: Modify `src/contexts/orchestration/domain/agents/planning.ts`: call IFeedbackProvider, inject feedback context, apply guardrails, log audit entry. Implement Steering doc override check.
  - **REFACTOR**: Extract guardrail application into pure function; ensure audit logging doesn't affect return value
  - _Design Spec: Sections 5.1, 5.3, 5.4, 5.5_

- [x] 14.10 Implement confidence audit logging
  - Create `src/contexts/orchestration/domain/models/confidence-audit.ts`: ConfidenceAuditEntry interface (planId, rawConfidence, adjustedConfidence, guardrailApplied, summaryUsed, ragFallback, feedbackEntriesConsidered)
  - Modify plan publication to include confidence audit entry in plan metadata
  - Ensure audit trail captures all confidence adjustments
  - _Design Spec: Section 5.5_

- [x] 14.11 Write property tests for feedback system
  - **RED**: Write fast-check property tests: (1) Guardrail bounds — adjusted confidence is always 0-100; ceiling >= floor when both exist, (2) Feedback completeness — every outcome event produces exactly one feedback entry, (3) Summary stability — given same dataset, aggregator always produces same summaries
  - **GREEN**: Implement generators for summary inputs and outcome event sequences; run property tests and fix violations
  - **REFACTOR**: Add edge case generators (empty datasets, single-entry buckets); validate boundary conditions
  - _Design Spec: Section 8.2_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 14.1, 14.2 | 6 |
| 14.3, 14.4 | 6 |
| 14.5, 14.6, 14.7 | 7 |
| 14.8, 14.9, 14.10 | 7 |
| 14.11 | 8 |

---

## Cross-Context Dependencies

- **KB context** owns: feedback document storage (S3), feedback index (DynamoDB), feedback capture handler, Bedrock KB data source for RAG
- **Orchestration context** owns: feedback summaries (DynamoDB), aggregator (hourly Lambda), IFeedbackProvider adapter, Planning agent modification
- **Aggregator reads cross-context:** Orchestration's aggregator Lambda queries KB's `feedback-index` table (requires IAM cross-context permissions via SSM-discovered table ARN)

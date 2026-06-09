# Task Group 13: Feedback Loop & Continuous Learning

**Bounded Context:** Knowledge Base (storage) + Orchestration (aggregation + consumption)
**Internal Pattern:** Simple Lambda handlers + scheduled aggregation
**Dependencies:** Task Group 01 (foundation), Task Group 04 (Orchestration agents), Task Group 05 (KB infrastructure), Task Group 06 (Execution publishes outcome events)
**Design Spec:** `docs/superpowers/specs/2026-06-08-feedback-loop-continuous-learning-design.md`

---

## Tasks

- [ ] 14.1 Add feedback infrastructure to Knowledge Base Terraform module
  - Modify `terraform/contexts/knowledge-base/dynamodb.tf`: add `feedback-index` table with GSIs (`category-timestamp-index`, `module-signal-index`), `force_destroy = true`, on-demand capacity
  - Modify `terraform/contexts/knowledge-base/s3.tf`: add lifecycle rule for `feedback/` prefix path in existing storage bucket
  - Modify `terraform/contexts/knowledge-base/lambda.tf`: add `feedback-capture-handler` Lambda function
  - Modify `terraform/contexts/knowledge-base/eventbridge.tf`: add rules subscribing to `approval.decision`, `execution.completed`, `execution.failed`, `verification.completed` events
  - Modify `terraform/contexts/knowledge-base/iam.tf`: permissions for feedback-capture Lambda (DynamoDB write, S3 write, EventBridge)
  - Modify `terraform/contexts/knowledge-base/bedrock.tf`: add new data source pointing to `feedback/` S3 prefix for RAG retrieval
  - _Design Spec: Sections 3.3, 3.4, 7.1_

- [ ] 14.2 Add feedback aggregation infrastructure to Orchestration Terraform module
  - Modify `terraform/contexts/orchestration/dynamodb.tf`: add `feedback-summaries` table (no GSIs needed, single-item lookups by PK), `force_destroy = true`
  - Modify `terraform/contexts/orchestration/lambda.tf`: add `feedback-aggregator` Lambda function
  - Modify `terraform/contexts/orchestration/eventbridge.tf`: add EventBridge Scheduler rule (hourly) triggering `feedback-aggregator`
  - Modify `terraform/contexts/orchestration/iam.tf`: aggregator Lambda needs cross-context read access to KB's `feedback-index` DynamoDB table (via SSM lookup for table ARN)
  - _Design Spec: Sections 4.4, 7.2_

- [ ] 14.3 Define event schemas for feedback system
  - Create `contracts/events/knowledge-base/feedback.captured.schema.json`: feedback entry captured (id, workItemId, planId, signal, outcomeType, category, module, riskLevel, confidenceAtDecision)
  - Create `contracts/events/orchestration/feedback.summary-updated.schema.json`: aggregation run completed (summariesUpdated, timestamp)
  - Validate schemas conform to EventEnvelope standard
  - Register schemas in EventBridge Schema Registry
  - _Design Spec: Sections 7.3_

- [ ] 14.4 Implement feedback capture domain models
  - Create `src/contexts/knowledge-base/domain/models/feedback-entry.ts`: FeedbackEntry interface with all fields (id, workItemId, planId, timestamp, category, riskLevel, module, tags, signal, outcomeType, confidenceAtDecision, planStepCount, kbItemsUsed, rejectionReason, operatorNotes, failureDetail)
  - Create `src/contexts/knowledge-base/domain/models/feedback-mappers.ts`: functions to map each event type (approval.decision, execution.completed, execution.failed, verification.completed) to a FeedbackEntry
  - _Design Spec: Sections 3.1, 3.2_

- [ ] 14.5 Implement feedback capture handler
  - Create `src/contexts/knowledge-base/handlers/feedback-capture-handler.ts`: EventBridge triggered Lambda
  - Map incoming event to FeedbackEntry using mappers
  - Write feedback document to S3: `feedback/{category}/{YYYY-MM}/{feedbackId}.json`
  - Write index entry to `feedback-index` DynamoDB table
  - Publish `feedback.captured` event
  - Handle mapping failures gracefully: log error, send to DLQ, never block execution flow
  - Apply structured logging with correlationId and X-Ray tracing
  - _Design Spec: Sections 3.2, 3.3, 6_

- [ ] 14.6 Implement feedback aggregation domain models
  - Create `src/contexts/orchestration/domain/models/feedback-summary.ts`: FeedbackSummary interface with stats (totalPlans, successRate, approvalRate, averageConfidence, confidenceAccuracy, recentTrend), guardrails (confidenceCeiling, confidenceFloor, requiresHumanReview, reason), commonFailures, successPatterns
  - Create `src/contexts/orchestration/domain/models/guardrail-rules.ts`: guardrail derivation logic — threshold conditions mapping to ceiling/floor/review values (5 consecutive failures → ceiling 40; success rate < 30% → ceiling 50; etc.)
  - _Design Spec: Sections 4.2, 4.3_

- [ ] 14.7 Implement feedback aggregator Lambda
  - Create `src/contexts/orchestration/handlers/feedback-aggregator.ts`: scheduled Lambda (hourly via EventBridge Scheduler)
  - Query `feedback-index` table by category/module/riskLevel buckets (GSI queries)
  - For each bucket: compute success rate, approval rate, average confidence, recent trend (last 10 vs prior 10)
  - Derive guardrails using threshold rules from 14.6
  - Identify common failure patterns (top 3 by frequency) and success patterns (top 3)
  - Write/overwrite FeedbackSummary to `feedback-summaries` DynamoDB table
  - Publish `feedback.summary-updated` event
  - Handle partial failures: if one bucket fails, continue with others, log errors
  - Alert after 3 consecutive full-run failures
  - _Design Spec: Sections 4.1, 4.3, 6_

- [ ] 14.8 Implement IFeedbackProvider port and adapter
  - Create `src/contexts/orchestration/domain/ports/IFeedbackProvider.ts`: interface with `getSummary(category, module, riskLevel)` and `queryFeedbackHistory(query, limit)`
  - Create `src/contexts/orchestration/adapters/feedback-provider.ts`: implements IFeedbackProvider
    - `getSummary`: DynamoDB get-item from `feedback-summaries` table by composite PK
    - `queryFeedbackHistory`: queries Bedrock KB feedback data source for RAG retrieval (5-second timeout)
  - Handle unavailability: return null from getSummary, empty array from queryFeedbackHistory — never throw
  - _Design Spec: Sections 5.2, 6_

- [ ] 14.9 Modify Planning agent to integrate feedback context
  - Modify `src/contexts/orchestration/domain/agents/planning.ts`:
    - After receiving research results, call `IFeedbackProvider.getSummary()` for the work item's category/module/riskLevel
    - If no summary (novel situation): call `IFeedbackProvider.queryFeedbackHistory()` as RAG fallback
    - Inject feedback context into planning prompt (statistics, common failures, success patterns, OR RAG results for novel situations)
    - After generating raw confidence: apply guardrail logic (cap at ceiling, boost to floor, force human review)
    - Log ConfidenceAuditEntry (rawConfidence, adjustedConfidence, guardrailApplied, summaryUsed, ragFallback)
  - Implement Steering doc override: check if team lead Steering doc specifies guardrail override, Steering wins
  - _Design Spec: Sections 5.1, 5.3, 5.4, 5.5_

- [ ] 14.10 Implement confidence audit logging
  - Create `src/contexts/orchestration/domain/models/confidence-audit.ts`: ConfidenceAuditEntry interface (planId, rawConfidence, adjustedConfidence, guardrailApplied, summaryUsed, ragFallback, feedbackEntriesConsidered)
  - Modify plan publication to include confidence audit entry in plan metadata
  - Ensure audit trail captures all confidence adjustments
  - _Design Spec: Section 5.5_

- [ ]* 14.11 Write property tests for feedback system
  - **Property: Guardrail bounds** — adjusted confidence is always 0-100; ceiling >= floor when both exist (use fast-check with arbitrary summary inputs)
  - **Property: Feedback completeness** — every outcome event (approved, rejected, succeeded, failed, verified) produces exactly one feedback entry
  - **Property: Summary stability** — given same feedback dataset, aggregator always produces same summaries (deterministic)
  - _Design Spec: Section 8.2_

- [ ]* 14.12 Write unit tests for feedback system
  - Test feedback capture: mapping from each event type to FeedbackEntry
  - Test aggregator: success rate computation, trend detection, guardrail derivation
  - Test guardrail logic: ceiling application, floor application, human review flag, invalid guardrail handling (ceiling < floor)
  - Test IFeedbackProvider: summary lookup hit/miss, RAG fallback, timeout handling
  - Test Planning agent integration: prompt injection format, confidence adjustment
  - _Design Spec: Sections 6, 8.1_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 14.1, 14.2 | 6 |
| 14.3, 14.4 | 6 |
| 14.5, 14.6, 14.7 | 7 |
| 14.8, 14.9, 14.10 | 7 |
| 14.11, 14.12 | 8 |

---

## Cross-Context Dependencies

- **KB context** owns: feedback document storage (S3), feedback index (DynamoDB), feedback capture handler, Bedrock KB data source for RAG
- **Orchestration context** owns: feedback summaries (DynamoDB), aggregator (hourly Lambda), IFeedbackProvider adapter, Planning agent modification
- **Aggregator reads cross-context:** Orchestration's aggregator Lambda queries KB's `feedback-index` table (requires IAM cross-context permissions via SSM-discovered table ARN)

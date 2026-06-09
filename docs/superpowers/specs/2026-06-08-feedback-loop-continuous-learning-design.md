# Feedback Loop & Continuous Learning System — Design Specification

**Date:** 2026-06-08
**Author:** Matt Rogers + Kiro
**Status:** Draft → Pending Approval

---

## 1. Overview

ForgeAdmin agents generate plans, execute them, and verify outcomes — but currently, the results of those outcomes don't systematically feed back into future decision-making. When a plan is rejected, an execution fails, or a rollback fires, that information is logged but not leveraged.

This feature introduces a continuous learning pipeline that captures every outcome signal (positive and negative), aggregates them into statistical summaries, and injects relevant feedback context into the Planning agent at decision time. The result: agents that learn from their mistakes, reinforce successful patterns, and have data-driven confidence guardrails that prevent repeated failures.

## 2. Key Decisions

- **Signal scope:** All outcomes captured — approvals, rejections, execution success/failure, verification pass/fail, rollbacks. Positive signals are as important as negative.
- **Architecture:** Shared across KB (stores + indexes feedback) and Orchestration (aggregates + consumes). No new bounded context.
- **Retrieval strategy:** Hybrid — pre-computed statistical summaries for known patterns (fast, cheap), RAG fallback against raw feedback for novel situations (slower but comprehensive).
- **Confidence modification:** Hard guardrails from data (ceiling/floor caps), nuance from LLM (interprets context within bounds). Team leads can override via Steering docs.
- **Aggregation cadence:** Hourly background job. Acceptable lag for patterns that develop over days/weeks.

## 3. Feedback Capture — Data Model

### 3.1 Feedback Entry Structure

```typescript
interface FeedbackEntry {
  id: string;                           // UUID
  workItemId: string;                   // Originating work item
  planId: string;                       // Plan that was evaluated/executed
  timestamp: string;                    // ISO-8601

  // Classification context (for aggregation bucketing)
  category: string;                     // Work item category (from triage)
  riskLevel: 'low' | 'medium' | 'high';
  module: string;                       // Which module was involved
  tags: string[];                       // Free-form tags (OU, server group, service, etc.)

  // Outcome
  signal: 'positive' | 'negative';
  outcomeType: 'plan-approved' | 'plan-rejected' | 'execution-succeeded' |
               'execution-failed' | 'verification-passed' | 'verification-failed' |
               'rollback-triggered' | 'rollback-succeeded' | 'rollback-failed';

  // Context for learning
  confidenceAtDecision: number;         // What confidence score was assigned at plan time
  planStepCount: number;                // How many steps the plan had
  kbItemsUsed: string[];               // Which KB items informed the plan

  // Human feedback (when available)
  rejectionReason?: string;             // Free text from approver on rejection
  operatorNotes?: string;              // Post-execution notes from team

  // Failure specifics (for negative signals)
  failureDetail?: {
    failedStep: number;                 // Which step failed (1-indexed)
    expectedOutcome: string;
    actualOutcome: string;
    rootCause?: string;                 // If identified
  };
}
```

### 3.2 Event Sources

| Event | Signal | OutcomeType | Captured From |
|-------|--------|-------------|---------------|
| `approval.decision` (approved) | positive | plan-approved | Dashboard context |
| `approval.decision` (rejected) | negative | plan-rejected | Dashboard context (includes rejection reason) |
| `execution.completed` | positive | execution-succeeded | Execution context |
| `execution.failed` | negative | execution-failed | Execution context (includes failed step detail) |
| `verification.completed` (all pass) | positive | verification-passed | Orchestration context |
| `verification.completed` (mismatch) | negative | verification-failed | Orchestration context |
| rollback triggered within `execution.failed` | negative | rollback-triggered | Execution context |

### 3.3 Storage

- Raw feedback documents: `s3://forgeadmin-storage-{env}/feedback/{category}/{YYYY-MM}/{feedbackId}.json`
- Indexed in a dedicated Bedrock Knowledge Base data source (separate from runbooks KB) for RAG retrieval
- DynamoDB index table in KB context for fast aggregation queries

### 3.4 DynamoDB Table: `feedback-index` (KB context)

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | `FEEDBACK#{feedbackId}` | Partition key |
| SK | `META` | Sort key |
| category | String | Work item category |
| module | String | Module name |
| outcomeType | String | Result type |
| signal | String | positive/negative |
| timestamp | String | ISO-8601 |
| confidenceAtDecision | Number | Original confidence score |
| planId | String | Link to plan |

**GSI-1:** `category-timestamp-index` — aggregation queries: "all feedback for category X in last 90 days"
**GSI-2:** `module-signal-index` — "all negative signals for module Y"

## 4. Aggregation Engine & Statistical Summaries

### 4.1 Aggregator Lambda (Orchestration context)

A scheduled Lambda runs every hour, queries the `feedback-index` table, and produces pre-computed summaries per category/module/riskLevel bucket.

### 4.2 Summary Structure

```typescript
interface FeedbackSummary {
  id: string;                           // Composite key: category + module + riskLevel
  category: string;
  module: string;
  riskLevel: 'low' | 'medium' | 'high';

  stats: {
    totalPlans: number;
    successRate: number;                // 0-1
    approvalRate: number;               // 0-1
    averageConfidence: number;
    confidenceAccuracy: number;         // How well confidence predicted outcomes
    recentTrend: 'improving' | 'stable' | 'degrading';
    lastUpdated: string;
  };

  guardrails: {
    confidenceCeiling: number | null;
    confidenceFloor: number | null;
    requiresHumanReview: boolean;
    reason: string;
  };

  commonFailures: {
    pattern: string;
    frequency: number;
    lastOccurred: string;
  }[];

  successPatterns: {
    pattern: string;
    frequency: number;
    lastOccurred: string;
  }[];
}
```

### 4.3 Guardrail Derivation Rules

| Condition | Guardrail |
|-----------|-----------|
| Last 5 plans in bucket ALL failed | `confidenceCeiling: 40`, `requiresHumanReview: true` |
| Last 5 plans ALL succeeded | `confidenceFloor: 60` |
| Success rate < 30% over last 30 days (min 5 plans) | `confidenceCeiling: 50`, `requiresHumanReview: true` |
| Success rate > 90% over last 30 days (min 10 plans) | `confidenceFloor: 70` |
| Insufficient data (< 5 plans in bucket) | No guardrails applied |

**Override:** Team leads can override computed guardrails via Steering docs. Steering docs take precedence over computed guardrails.

### 4.4 DynamoDB Table: `feedback-summaries` (Orchestration context)

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | `SUMMARY#{category}#{module}#{riskLevel}` | Partition key |
| SK | `LATEST` | Sort key |
| + all FeedbackSummary fields | | |

Overwritten on each aggregation run. No TTL (always hot, refreshed hourly).

## 5. Planning Agent Integration

### 5.1 Decision-Time Flow

```
1. Receive work item + research results (existing flow)
2. Fetch FeedbackSummary for this item's category/module/riskLevel
3. If no summary exists (novel situation), RAG query feedback KB for similar past outcomes
4. Generate plan + raw confidence score (existing logic)
5. Apply guardrails to raw confidence:
   a. If confidenceCeiling exists and raw > ceiling → cap at ceiling
   b. If confidenceFloor exists and raw < floor → boost to floor
   c. If requiresHumanReview → force approval gate regardless of auto-execute threshold
6. Publish plan with adjusted confidence + feedback context in justification
```

### 5.2 New Port

```typescript
interface IFeedbackProvider {
  getSummary(category: string, module: string, riskLevel: string): Promise<FeedbackSummary | null>;
  queryFeedbackHistory(query: string, limit: number): Promise<FeedbackEntry[]>;
}
```

### 5.3 Prompt Injection — Known Patterns

```markdown
## Historical Feedback Context

**Category:** account/service-request | **Module:** ad-management | **Risk:** medium

**Statistics (last 90 days):**
- Plans proposed: 23 | Approved: 21 (91%) | Executed: 19
- Execution success rate: 84% (16/19)
- Average confidence at decision: 72
- Trend: stable

**Guardrails Active:**
- None currently applied

**Common Failure Patterns:**
1. Replication lag not checked before AD change (3/3 recent failures)
2. Service account dependency missed (1/3 recent failures)

**Success Patterns:**
1. Pre-flight replication health check included (14/16 successes)
2. Staged rollout to single OU before expanding (12/16 successes)

**Instruction:** Factor these patterns into your plan generation and confidence scoring.
```

### 5.4 Prompt Injection — Novel Situations (RAG fallback)

```markdown
## Historical Feedback Context

**No statistical summary available for this category/module/risk combination.**

**Similar past outcomes (RAG retrieved, top 3):**
1. [2026-05-20] Similar DNS change plan → SUCCEEDED (confidence: 68)
   - Key: included TTL verification step
2. [2026-05-15] Similar DNS change plan → FAILED (confidence: 72)
   - Key: didn't wait for TTL expiry before verification
3. [2026-04-28] Similar DNS change plan → SUCCEEDED (confidence: 55)
   - Key: extended verification wait to 2x TTL

**Instruction:** Use these past outcomes to inform your plan. No guardrails applied (insufficient data).
```

### 5.5 Confidence Adjustment Audit

```typescript
interface ConfidenceAuditEntry {
  planId: string;
  rawConfidence: number;
  adjustedConfidence: number;
  guardrailApplied: string | null;
  summaryUsed: string | null;
  ragFallback: boolean;
  feedbackEntriesConsidered: number;
}
```

Every adjustment logged in audit trail for full transparency.

## 6. Error Handling & Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Feedback capture fails (event handler error) | Log error, item to DLQ. Planning agent proceeds without that entry. Never blocks execution flow. |
| Aggregator Lambda fails mid-run | Existing summaries remain (stale but valid). Next hourly run retries. Alert after 3 consecutive failures. |
| Summary lookup fails at plan time | Planning agent proceeds without statistical context (base behavior). Logs degradation. RAG fallback NOT attempted (avoids cascading failures). |
| RAG query to feedback KB times out (5s timeout) | Planning agent proceeds without historical feedback. Logs timeout. |
| Guardrail produces invalid values (ceiling < floor) | Skip guardrails, log error, use raw confidence. Alert platform. |
| Feedback KB unavailable | Capture events go to DLQ for later processing. Planning proceeds with base behavior. |
| Team lead Steering doc conflicts with computed guardrail | Steering doc wins. Logged in audit trail. |

**Degradation Hierarchy:**
1. Full operation: feedback captured, summaries fresh, guardrails active, RAG available
2. Stale summaries: aggregator hasn't run recently — last-known summaries still useful
3. No summaries: novel category — RAG fallback for similar cases
4. Fully degraded: all feedback systems unavailable — Planning agent uses base behavior (same as before this feature existed)

## 7. Infrastructure

### 7.1 Knowledge Base Context (additions)

- New S3 path: `s3://forgeadmin-storage-{env}/feedback/{category}/{YYYY-MM}/`
- New Bedrock KB data source for feedback (separate from runbooks)
- New DynamoDB table: `feedback-index` with GSIs
- New Lambda: `feedback-capture-handler` (EventBridge triggered)

### 7.2 Orchestration Context (additions)

- New DynamoDB table: `feedback-summaries`
- New Lambda: `feedback-aggregator` (EventBridge Scheduler, hourly)
- New adapter: `src/contexts/orchestration/adapters/feedback-provider.ts`
- New port: `src/contexts/orchestration/domain/ports/IFeedbackProvider.ts`
- Modified: Planning agent domain logic (confidence adjustment + prompt injection)

### 7.3 New Event Schemas

```
contracts/events/knowledge-base/feedback.captured.schema.json
contracts/events/orchestration/feedback.summary-updated.schema.json
```

### 7.4 Dashboard

No new Dashboard views for this spec. The visibility layer is covered by Spec 4 (Operator Confidence Calibration Dashboard) which builds directly on this feedback data.

## 8. Testing Strategy

### 8.1 Testing Pyramid

| Level | What | Approach |
|-------|------|----------|
| Unit | Guardrail derivation, summary computation, confidence adjustment | Vitest |
| Property | Guardrail bounds, feedback completeness, summary determinism | fast-check |
| Contract | Event schemas | JSON Schema validation in CI |
| Integration | Full pipeline: rejection → capture → aggregate → adjusted confidence | LocalStack |

### 8.2 Property Tests

| Property | Description |
|----------|-------------|
| Guardrail bounds | Adjusted confidence is always 0-100. Ceiling >= floor when both exist. |
| Feedback completeness | Every outcome event produces exactly one feedback entry |
| Summary stability | Given the same feedback dataset, aggregator always produces the same summaries |

## 9. Execution Order

| Task | Wave | Description |
|------|------|-------------|
| Feedback index DynamoDB + S3 paths (KB context) | 6 | Storage infrastructure |
| Feedback capture handler (KB context) | 6 | EventBridge → S3 + DynamoDB |
| Feedback summaries DynamoDB (Orchestration) | 6 | Aggregation output storage |
| Feedback aggregator Lambda (Orchestration) | 7 | Hourly background job |
| IFeedbackProvider port + adapter (Orchestration) | 7 | Wiring layer |
| Planning agent modification (Orchestration) | 7 | Integrate feedback into plan generation |
| Bedrock KB data source for feedback (KB context) | 7 | RAG retrieval capability |
| Property tests | 8 | Correctness validation |

## 10. Relationship to Other Enhancement Specs

- **Spec 4 (Confidence Calibration Dashboard):** Directly consumes the `feedback-summaries` table and `feedback-index` to render calibration visualizations. This spec provides the data engine; Spec 4 provides the visibility layer.
- **Spec 1 (Incident Correlation):** Correlated items that form groups produce feedback entries at the group level (parent work item outcome), not per-child. This avoids double-counting.
- **Skills & Steering:** Team leads can override guardrails and inject additional feedback interpretation instructions via Steering docs.

# Task Group 12: Incident Correlation & Pattern Detection

**Bounded Context:** Correlation
**Internal Pattern:** Simple Lambda handlers + event-driven session management
**Dependencies:** Task Group 01 (foundation), Task Group 02 (event schemas), Task Group 03 (Ingestion publishes `work-item.created`)
**Terraform State:** `forgeadmin/correlation/terraform.tfstate`
**Design Spec:** `docs/superpowers/specs/2026-06-08-incident-correlation-pattern-detection-design.md`

---

## Tasks

- [ ] 13.1 Create Correlation Terraform module
  - Create `terraform/contexts/correlation/main.tf` with S3 backend key `forgeadmin/correlation/terraform.tfstate`
  - Create `terraform/contexts/correlation/dynamodb.tf`: `correlation-sessions` table with GSIs (`ruleId-matchKey-index`, `status-index`), `correlation-rules` table, `force_destroy = true`, on-demand capacity, PITR enabled
  - Create `terraform/contexts/correlation/sqs.tf`: input buffer queue + DLQ for burst absorption
  - Create `terraform/contexts/correlation/lambda.tf`: `on-work-item-created`, `on-session-expired`, `sweeper` Lambda functions
  - Create `terraform/contexts/correlation/eventbridge.tf`: rule subscribing to `work-item.created` events, EventBridge Scheduler permissions for gap timeouts
  - Create `terraform/contexts/correlation/iam.tf`: per-Lambda IAM roles with DynamoDB, SQS, EventBridge, EventBridge Scheduler access
  - Create `terraform/contexts/correlation/outputs.tf`: SSM parameters for session table ARN, rules table ARN
  - SSM lookups for EventBridge bus ARN
  - _Design Spec: Sections 3, 8_

- [ ] 13.2 Define event schemas for Correlation context
  - Create `contracts/events/correlation/work-item.correlated.schema.json`: enriched work item with correlationContext (groupId, ruleMatched, action, relatedItems, historicalMatch)
  - Create `contracts/events/correlation/correlation-group.detected.schema.json`: group formed (groupId, ruleId, action, memberItems, parentWorkItem)
  - Create `contracts/events/correlation/correlation-group.updated.schema.json`: group gained member or historical match found
  - Validate schemas conform to EventEnvelope standard (source, detail-type, detail with version/correlationId/timestamp/payload)
  - Register schemas in EventBridge Schema Registry
  - _Design Spec: Sections 5.4, 8.2_

- [ ] 13.3 Create default correlation rules (code defaults)
  - Create `contracts/correlation-rules/temporal/ad-lockout-burst.json`: category=account, sourceOU exact match, gap=300s, min=3, action=merge
  - Create `contracts/correlation-rules/infrastructure/same-rack-alerts.json`: serverRack + alertType exact match, gap=600s, min=2, action=enrich
  - Create `contracts/correlation-rules/causal/dependency-chain.json`: affectedService exact match, temporal order within 300s, action=merge
  - Create `contracts/correlation-rules/repeat/recurring-pattern.json`: category + errorCode fuzzy match (threshold=0.8), lookback=90d, action=enrich
  - Create `contracts/correlation-rules/schema.json`: JSON Schema for CorrelationRule validation
  - _Design Spec: Sections 4.2, 4.3_

- [ ] 13.4 Implement domain models and ports
  - Create `src/contexts/correlation/domain/models/correlation-rule.ts`: CorrelationRule, MatchAttribute, FailureAction interfaces
  - Create `src/contexts/correlation/domain/models/correlation-session.ts`: CorrelationSession entity with open/closed status, member tracking, expiry management
  - Create `src/contexts/correlation/domain/models/correlation-group.ts`: CorrelationGroup entity with parent work item synthesis, member list, metadata
  - Create `src/contexts/correlation/domain/ports/IRuleProvider.ts`: fetch active rules (code defaults merged with Dashboard overrides)
  - Create `src/contexts/correlation/domain/ports/ISessionStore.ts`: session CRUD (create, addItem, close, getByRuleAndMatchKey)
  - Create `src/contexts/correlation/domain/ports/IEventPublisher.ts`: publish correlation events
  - Create `src/contexts/correlation/domain/ports/IHistoryLookup.ts`: query past items for repeat-incident detection (hot + cold paths)
  - Create `src/contexts/correlation/domain/ports/IWorkItemEnricher.ts`: enrich items with correlation context
  - _Design Spec: Sections 3.1, 4.1_

- [ ] 13.5 Implement rule evaluator engine
  - Create `src/contexts/correlation/domain/engine/rule-evaluator.ts`
  - Load active rules from IRuleProvider, sort by priority (lower = first)
  - Evaluate incoming work item against each rule in order
  - Implement exact match logic: compare item field values against rule match attributes
  - Implement fuzzy match logic: similarity scoring with configurable threshold (0-1)
  - First matching rule wins — return matched rule or null
  - Handle malformed rules gracefully: skip, log error, continue with remaining rules
  - _Design Spec: Sections 4.1, 4.3, 6_

- [ ] 13.6 Implement session manager
  - Create `src/contexts/correlation/domain/engine/session-manager.ts`
  - On rule match: check ISessionStore for open session with same ruleId + matchKey
  - If open session exists: add item, reset gap timer (update EventBridge Scheduler)
  - If no open session: create new session, add item, create gap timer schedule
  - Implement matchKey generation: composite key from matched rule attributes
  - Enforce maxDuration hard cap: close session regardless of activity if openedAt + maxDuration reached
  - Handle session store unavailability: pass item through as `work-item.correlated` with no group context
  - _Design Spec: Sections 5.1, 5.3_

- [ ] 13.7 Implement group finalizer
  - Create `src/contexts/correlation/domain/engine/group-finalizer.ts`
  - On session close: evaluate item count against rule's minItems threshold
  - If items >= minItems: form CorrelationGroup, synthesize parent work item (for merge actions), publish `correlation-group.detected`
  - If items < minItems: dissolve session, publish individual `work-item.correlated` for each member as passthrough
  - For enrich actions: publish `work-item.correlated` for each member with correlationContext populated
  - Generate `suggestedRootCause` string from matched rule + member item patterns
  - _Design Spec: Sections 5.1, 5.4_

- [ ] 13.8 Implement adapters
  - Create `src/contexts/correlation/adapters/dynamodb-session-store.ts`: implements ISessionStore using `correlation-sessions` table with GSI queries
  - Create `src/contexts/correlation/adapters/rule-provider.ts`: implements IRuleProvider, loads code defaults from JSON + DynamoDB overrides, merges with priority (dashboard overrides code)
  - Create `src/contexts/correlation/adapters/eventbridge-publisher.ts`: implements IEventPublisher, validates events against schema before publishing
  - Create `src/contexts/correlation/adapters/dynamodb-history-lookup.ts`: implements IHistoryLookup for ≤90 day repeat detection (DynamoDB query by category + errorCode)
  - Create `src/contexts/correlation/adapters/s3-history-lookup.ts`: implements IHistoryLookup for >90 day repeat detection (async S3 query, non-blocking)
  - _Design Spec: Sections 3.1, 4.3, 5.2_

- [ ] 13.9 Implement Lambda handlers
  - Create `src/contexts/correlation/handlers/on-work-item-created.ts`: SQS trigger (buffered from EventBridge), wires rule evaluator → session manager → event publishing. Handles no-match passthrough.
  - Create `src/contexts/correlation/handlers/on-session-expired.ts`: EventBridge Scheduler callback, checks if session was extended since schedule was set, calls group finalizer if truly expired
  - Create `src/contexts/correlation/handlers/on-rule-updated.ts`: EventBridge trigger on Dashboard rule changes, invalidates any cached rules in Lambda execution context
  - Create sweeper Lambda (EventBridge scheduled, every 5 minutes): scans for sessions past maxExpiresAt and force-closes them (fallback for scheduler failures)
  - Apply structured logging with correlationId and X-Ray tracing on all handlers
  - _Design Spec: Sections 3.1, 5.1, 5.3, 6_

- [ ] 13.10 Implement fallback routing rule for graceful degradation
  - Create EventBridge rule: if `work-item.created` event is not consumed within 60 seconds, route directly to Orchestration context
  - Implementation: EventBridge rule with SQS DLQ monitoring — if DLQ depth increases, Orchestration receives unenhanced items via separate rule
  - Document: Orchestration must subscribe to both `work-item.correlated` (primary) and `work-item.created` (fallback, 60s delay) events
  - _Design Spec: Sections 5.5, 6_

- [ ] 13.11 Implement Dashboard API endpoints for correlation rule management
  - Create `src/contexts/dashboard/api/handlers/correlation-rules.ts`: GET /correlation/rules, POST /correlation/rules, PUT /correlation/rules/:id, DELETE /correlation/rules/:id
  - Create `src/contexts/dashboard/api/handlers/correlation-sessions.ts`: GET /correlation/sessions, GET /correlation/sessions/:id
  - Create `src/contexts/dashboard/api/handlers/correlation-groups.ts`: GET /correlation/groups, GET /correlation/groups/:id
  - Create `src/contexts/dashboard/api/handlers/correlation-insights.ts`: GET /correlation/insights (aggregated metrics)
  - Implement RBAC: team_lead for CRUD, team_member for read-only
  - Implement request validation from schema
  - _Design Spec: Sections 7.2_

- [ ] 13.12 Implement Dashboard UI for Correlation
  - Create Correlation Rules Management page: list all rules (code defaults read-only, Dashboard overrides editable), name/type/action/enabled toggle/match attributes/window config
  - Create Active Sessions view: real-time WebSocket-fed view of open sessions with rule name, match key, item count, gap countdown
  - Create Correlation Groups History view: past groups filterable by date, rule, action type, with links to parent work items
  - Create Correlation Insights panel: groups formed today, most active rules, correlated vs passthrough ratio, average session duration
  - Add Zustand store slice: `correlation` with rules, sessions, groups, insights
  - Integrate WebSocket subscription for `correlation-group.detected` and `correlation-group.updated` events
  - _Design Spec: Section 7.1_

- [ ]* 13.13 Write property tests for Correlation engine
  - **Property: Session determinism** — given same sequence of work items and rules, engine always produces same groups (use fast-check to generate arbitrary item sequences)
  - **Property: Rule isolation** — an item can join at most one session; no item appears in multiple groups
  - **Property: Graceful passthrough** — if rules are empty or engine errors, every item still produces exactly one `work-item.correlated` event
  - _Design Spec: Section 9.2_

- [ ]* 13.14 Write unit tests for Correlation context
  - Test rule evaluator: exact match, fuzzy match, priority ordering, malformed rule handling
  - Test session manager: new session creation, item joining, gap timer reset, maxDuration cap
  - Test group finalizer: minItems threshold, merge vs enrich action, session dissolution
  - Test adapters: rule merging (code + dashboard), history lookup hot/cold paths
  - Test handlers: passthrough on no match, scheduler callback idempotency
  - _Design Spec: Sections 6, 9.1_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 13.1 | 3 |
| 13.2, 13.3 | 3 |
| 13.4 | 4 |
| 13.5, 13.6, 13.7 | 5 |
| 13.8, 13.9, 13.10 | 6 |
| 13.11, 13.13, 13.14 | 7 |
| 13.12 | 9 |

---

## Orchestration Context Integration (modifications to existing Task Group 04)

The following changes are required in the Orchestration context to consume correlation events:

- Modify `terraform/contexts/orchestration/eventbridge.tf`: add rule subscribing to `work-item.correlated` and `correlation-group.detected` (primary), retain `work-item.created` subscription as 60-second fallback
- Modify `src/contexts/orchestration/handlers/on-work-item-created.ts`: rename to `on-work-item-received.ts`, handle both `work-item.correlated` and fallback `work-item.created` events
- Modify Triage agent: consume `correlationContext` from enriched items to improve classification
- Modify Research agent: use `historicalMatch` from correlation context to inform KB queries
- Modify Supervisor: handle `correlation-group.detected` events by triaging synthesized parent work items

These modifications integrate with existing Wave 5-7 tasks in Task Group 04.

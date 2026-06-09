# Incident Correlation & Pattern Detection Engine — Design Specification

**Date:** 2026-06-08
**Author:** Matt Rogers + Kiro
**Status:** Draft → Pending Approval

---

## 1. Overview

ForgeAdmin's Ingestion context normalizes and deduplicates individual work items, but treats each as independent. Real-world incidents often cluster — 5 password lockouts from the same OU in 10 minutes, 3 disk alerts from the same rack, a DNS failure followed by 12 "cannot connect" errors. Without correlation, the platform fights the same fire multiple times in parallel.

This feature introduces a new **Correlation** bounded context that sits between Ingestion and Orchestration. It evaluates incoming work items against configurable correlation rules, groups related items using session windows, and publishes enriched events that give downstream agents (Triage, Research, Planning) critical context about related incidents and historical patterns.

## 2. Key Decisions

- **Architecture:** New bounded context with own Terraform state, following existing platform patterns
- **Correlation types:** Temporal clustering, infrastructure proximity, causal chains, repeat incident detection
- **Windowing:** Session windows with configurable gap timeout (closes after inactivity period)
- **Orchestration handling:** Hybrid — configurable per rule. Some correlations merge into a parent work item; others enrich individual items with group context.
- **Historical lookback:** Configurable per rule, default 90 days (DynamoDB hot), optional S3 cold path for longer cycles
- **Rule management:** Code provides base defaults, Dashboard allows team lead overrides. Consistent with Skills & Steering pattern.
- **Graceful degradation:** If Correlation is down, items pass through to Orchestration unenhanced after 60-second fallback delay. Never blocks work item processing.

## 3. Architecture & Context Boundaries

### 3.1 Internal Structure

```
contexts/correlation/
├── domain/
│   ├── models/
│   │   ├── correlation-rule.ts       # Rule definition (match criteria, action, window config)
│   │   ├── correlation-session.ts    # Active session (open/closed, member items, expiry)
│   │   └── correlation-group.ts      # Finalized group (parent item, children, metadata)
│   ├── ports/
│   │   ├── IRuleProvider.ts          # Fetch active rules (code defaults + Dashboard overrides)
│   │   ├── ISessionStore.ts          # Session CRUD (DynamoDB)
│   │   ├── IEventPublisher.ts        # Publish correlation events
│   │   ├── IHistoryLookup.ts         # Query past items for repeat-incident detection
│   │   └── IWorkItemEnricher.ts      # Enrich items with correlation context
│   └── engine/
│       ├── rule-evaluator.ts         # Evaluates an item against all active rules
│       ├── session-manager.ts        # Open/join/close sessions based on gap timeout
│       └── group-finalizer.ts        # When session closes, produce correlation group
├── adapters/
│   ├── dynamodb-session-store.ts
│   ├── s3-history-lookup.ts          # For >90 day repeat detection (async)
│   ├── dynamodb-history-lookup.ts    # For ≤90 day repeat detection (sync)
│   ├── rule-provider.ts             # Merges code defaults + DynamoDB overrides
│   └── eventbridge-publisher.ts
├── handlers/
│   ├── on-work-item-created.ts      # EventBridge trigger — main entry point
│   ├── on-session-expired.ts        # EventBridge Scheduler callback — closes session
│   └── on-rule-updated.ts           # Dashboard rule change — invalidates cached rules
└── terraform/
    └── (own state file: forgeadmin/correlation/terraform.tfstate)
```

### 3.2 Position in Event Flow

```
Ingestion → publishes work-item.created
    ↓
Correlation → evaluates rules, manages sessions
    ↓ (publishes one of:)
    ├── work-item.correlated (enriched item, passes through to Orchestration)
    ├── correlation-group.detected (new group formed, action=merge → creates parent work item)
    └── correlation-group.updated (existing group gained a member)
    ↓
Orchestration → receives either individual enriched items OR parent group items
```

### 3.3 Independence

- Own Terraform state file (`forgeadmin/correlation/terraform.tfstate`)
- Can be `terraform destroy`'d without affecting other contexts
- Communicates exclusively via EventBridge events
- Correlation never blocks work items — graceful passthrough on failure

## 4. Correlation Rules — Data Model

### 4.1 Rule Structure

```typescript
interface CorrelationRule {
  id: string;
  name: string;                          // "AD Lockout Clustering"
  source: 'code' | 'dashboard';          // Code defaults vs team lead overrides
  enabled: boolean;
  priority: number;                       // Lower = evaluated first. Dashboard overrides code.

  // Match criteria — what makes items "related"
  match: {
    type: 'temporal' | 'infrastructure' | 'causal' | 'repeat';
    attributes: MatchAttribute[];         // Fields to compare
    similarity: 'exact' | 'fuzzy';       // Exact match vs substring/pattern
    threshold?: number;                   // For fuzzy: minimum similarity score (0-1)
  };

  // Session window configuration
  window: {
    gapTimeout: number;                   // Seconds of inactivity before session closes (default: 300)
    maxDuration: number;                  // Hard cap on session length (default: 3600 = 1 hour)
    minItems: number;                     // Minimum items to form a group (default: 2)
  };

  // Action when group forms
  action: 'merge' | 'enrich';            // merge = parent work item; enrich = tag individually

  // Historical lookback (for 'repeat' type)
  lookback?: {
    duration: number;                     // Seconds (default: 7776000 = 90 days)
    useColdStorage: boolean;              // Query S3 archive for >90 day matches
  };
}

interface MatchAttribute {
  field: string;        // e.g., "category", "sourceOU", "serverName", "errorCode"
  weight: number;       // 0-1, contributes to similarity scoring
}
```

### 4.2 Default Rules (shipped with platform)

| Type | Default Rule | Match Attributes | Action |
|------|-------------|-----------------|--------|
| Temporal | "AD Lockout Burst" | category=account, sourceOU (exact), gap=300s, min=3 | merge |
| Infrastructure | "Same-Rack Alerts" | serverRack (exact), alertType (exact), gap=600s, min=2 | enrich |
| Causal | "Dependency Chain" | affectedService (exact), temporal order within 300s | merge |
| Repeat | "Recurring Pattern" | category + errorCode (fuzzy, 0.8 threshold), lookback=90d | enrich |

### 4.3 Rule Layering

1. Code defaults loaded from `contracts/correlation-rules/*.json` at deploy time → seeded into DynamoDB with `source: 'code'`
2. Dashboard overrides stored in DynamoDB with `source: 'dashboard'`
3. At evaluation time, rules merged: dashboard rules with same `id` override code rules. Dashboard-only rules layer on top.
4. Rules sorted by priority, evaluated in order. First matching rule wins per item (an item can only join one session at a time).

### 4.4 DynamoDB Table: `correlation-rules`

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | `RULE#{ruleId}` | Partition key |
| SK | `META` | Sort key |
| + all CorrelationRule fields | | Stored as document |

Simple single-item lookups — no GSIs needed (rules are few, loaded in bulk).

## 5. Session Management & Data Flow

### 5.1 Session Lifecycle

```
1. work-item.created arrives
2. Rule Evaluator checks item against all active rules (priority order)
3. If a rule matches:
   a. Session Manager checks: is there an open session for this rule + match key?
      - YES → add item to session, reset gap timer
      - NO → create new session, add item, start gap timer
4. If no rule matches:
   a. Publish work-item.correlated (pass-through, no group context)
5. Gap timer fires (session expired):
   a. Group Finalizer evaluates session:
      - Items >= minItems? → form group, publish correlation-group.detected
      - Items < minItems? → dissolve session, publish individual work-item.correlated for each
```

### 5.2 DynamoDB Table: `correlation-sessions`

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | `SESSION#{sessionId}` | Partition key |
| SK | `META` or `ITEM#{workItemId}` | Sort key |
| ruleId | String | Which rule opened this session |
| matchKey | String | Composite key from matched attributes (e.g., `account\|OU=finance`) |
| status | String | `open` or `closed` |
| openedAt | String | ISO-8601 |
| lastActivityAt | String | ISO-8601 (updated on each item join) |
| expiresAt | Number | TTL epoch — gap timeout from last activity |
| maxExpiresAt | Number | Hard cap epoch (openedAt + maxDuration) |
| itemCount | Number | Running count of member items |
| schedulerArn | String | EventBridge Scheduler ARN for gap timeout callback |

**GSI-1:** `ruleId-matchKey-index` — fast lookup: "is there an open session for this rule + match key?"
**GSI-2:** `status-index` — list all open sessions (for Dashboard view)

### 5.3 Gap Timeout Mechanism

- When a session opens or an item joins, the handler creates/updates an EventBridge Scheduler one-time schedule set to fire at `lastActivityAt + gapTimeout`
- When the schedule fires, it invokes `on-session-expired` Lambda
- That Lambda checks if the session was extended since the schedule was set (compare `lastActivityAt` with expected). If extended, do nothing (a newer schedule already exists). If not, close the session.
- Hard cap: even if items keep arriving, session closes at `openedAt + maxDuration` (prevents infinite sessions from runaway alert storms)

### 5.4 Event Schemas

**`correlation-group.detected`:**

```json
{
  "source": "forgeadmin.correlation",
  "detail-type": "correlation-group.detected",
  "detail": {
    "version": "1.0",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "payload": {
      "groupId": "uuid",
      "ruleId": "ad-lockout-burst",
      "ruleName": "AD Lockout Burst",
      "action": "merge",
      "matchKey": "account|OU=finance",
      "itemCount": 5,
      "memberItems": ["item-id-1", "item-id-2", "..."],
      "sessionDuration": 180,
      "suggestedRootCause": "Multiple lockouts from same OU within 3 minutes",
      "parentWorkItem": {}
    }
  }
}
```

**`work-item.correlated`:**

```json
{
  "source": "forgeadmin.correlation",
  "detail-type": "work-item.correlated",
  "detail": {
    "version": "1.0",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "payload": {
      "workItem": {},
      "correlationContext": {
        "groupId": "uuid | null",
        "ruleMatched": "same-rack-alerts | null",
        "action": "enrich | passthrough",
        "relatedItems": ["item-id-3", "item-id-4"],
        "historicalMatch": {
          "found": true,
          "matchedItemId": "item-from-last-tuesday",
          "similarity": 0.87,
          "resolution": "Restarted print spooler service"
        }
      }
    }
  }
}
```

**`correlation-group.updated`:**

```json
{
  "source": "forgeadmin.correlation",
  "detail-type": "correlation-group.updated",
  "detail": {
    "version": "1.0",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "payload": {
      "groupId": "uuid",
      "ruleId": "ad-lockout-burst",
      "updateType": "item-added | historical-match-found",
      "newItemId": "item-id-6",
      "updatedItemCount": 6,
      "historicalMatch": {
        "found": true,
        "matchedItemId": "item-from-4-months-ago",
        "similarity": 0.82,
        "resolution": "Reset AD replication partner"
      }
    }
  }
}
```

### 5.5 Orchestration Integration

- Orchestration subscribes to `work-item.correlated` (instead of directly to `work-item.created`)
- For `action: merge` groups, Orchestration receives `correlation-group.detected` and triages the synthesized parent work item
- For `action: enrich` items, Orchestration receives individual items with `correlationContext` — Triage and Research agents use this for better classification and KB queries
- Graceful degradation: if Correlation context is down, a fallback EventBridge rule routes `work-item.created` directly to Orchestration after 60-second delay

## 6. Error Handling & Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Rule evaluation throws (malformed rule) | Skip that rule, log error, continue evaluating remaining rules. Item still gets processed. |
| DynamoDB session store unavailable | Pass item through as `work-item.correlated` with no group context. Log degradation. Notify Communication context. |
| EventBridge Scheduler fails to create/update | Session opens but won't auto-close. Fallback: sweeper Lambda runs every 5 minutes scanning for sessions past `maxExpiresAt` and force-closes them. |
| Session has 1 item when gap expires (below minItems) | Dissolve session. Publish individual `work-item.correlated` as passthrough. No group formed. |
| Item matches multiple rules | First matching rule wins (priority order). Item joins one session only. Prevents combinatorial explosion. |
| Alert storm (>100 items in 1 minute) | `maxDuration` hard cap prevents infinite sessions. SQS buffering on input absorbs bursts. |
| Historical S3 lookup times out | Proceed without historical context. Async retry — if match found later, publish `correlation-group.updated` to enrich existing group. |
| Correlation context fully down | Fallback EventBridge rule routes `work-item.created` directly to Orchestration after 60-second delay. Items unenhanced but never lost. |

**Degradation Hierarchy:**
1. Full operation: rules evaluated, sessions managed, groups formed
2. Partial degradation: rules evaluated but session store slow → items pass through enriched with rule match but no group tracking
3. Full degradation: context down → fallback rule delivers items directly to Orchestration

## 7. Dashboard Integration

### 7.1 New Views

1. **Correlation Rules Management Page** — list of all rules (code defaults read-only, Dashboard overrides editable). Shows: name, type, action, enabled toggle, match attributes, window config. Team leads create/edit/delete Dashboard override rules.

2. **Active Sessions View** — real-time view of open sessions. Shows: rule name, match key, item count, time since last activity, time until gap expires.

3. **Correlation Groups History** — past groups with: formation time, rule triggered, item count, action taken, link to parent work item (for merges). Filterable by date, rule, action type.

4. **Correlation Insights Panel** (Dashboard overview enhancement) — groups formed today, most active rules, correlated vs passthrough ratio, average session duration.

### 7.2 New API Endpoints

```
GET    /correlation/rules                    # List all rules (code + dashboard)
POST   /correlation/rules                    # Create dashboard override rule (team_lead only)
PUT    /correlation/rules/:id                # Update dashboard rule (team_lead only)
DELETE /correlation/rules/:id                # Delete dashboard rule (team_lead only)
GET    /correlation/sessions                 # List active sessions
GET    /correlation/sessions/:id             # Session detail with member items
GET    /correlation/groups                   # Historical groups (filterable)
GET    /correlation/groups/:id               # Group detail
GET    /correlation/insights                 # Aggregated metrics
```

**RBAC:** `team_lead` for CRUD, `team_member` for read-only.

## 8. Infrastructure

### 8.1 Terraform Resources

```
terraform/contexts/correlation/
├── main.tf              # S3 backend: forgeadmin/correlation/terraform.tfstate
├── dynamodb.tf          # correlation-sessions table + correlation-rules table, force_destroy=true
├── lambda.tf            # on-work-item-created, on-session-expired, sweeper
├── sqs.tf               # Input buffer queue + DLQ (absorbs bursts)
├── eventbridge.tf       # Rules subscribing to work-item.created, scheduler for gap timeouts
├── iam.tf               # Lambda roles, EventBridge Scheduler permissions
└── outputs.tf           # SSM params: session table ARN, rules table ARN
```

### 8.2 New Event Schemas (contracts)

```
contracts/events/correlation/work-item.correlated.schema.json
contracts/events/correlation/correlation-group.detected.schema.json
contracts/events/correlation/correlation-group.updated.schema.json
```

### 8.3 Impact on Existing Contexts

| Context | Change |
|---------|--------|
| Ingestion | None — still publishes `work-item.created` as before |
| Orchestration | Subscribe to `work-item.correlated` and `correlation-group.detected` instead of `work-item.created` directly. Fallback rule catches `work-item.created` after 60s if Correlation is down. |
| Dashboard | New API endpoints + UI views for rule management and session monitoring |
| Communication | Subscribes to `correlation-group.detected` for notifications |
| Platform | Audit trail captures correlation events. Correlation context health monitored. |

## 9. Testing Strategy

### 9.1 Testing Pyramid

| Level | What | Approach |
|-------|------|----------|
| Unit | Rule evaluator logic, session manager, group finalizer | Vitest, fast-check for property tests |
| Contract | Event schemas for all correlation events | JSON Schema validation in CI |
| Integration | Full flow: item in → session formed → gap fires → group published | LocalStack (EventBridge + DynamoDB + Scheduler) |

### 9.2 Property Tests

| Property | Description |
|----------|-------------|
| Session determinism | Given the same sequence of work items and rules, the engine always produces the same groups |
| Rule isolation | An item can join at most one session. No item appears in multiple groups. |
| Graceful passthrough | If rules are empty or engine errors, every item still produces exactly one `work-item.correlated` event |

## 10. Execution Order

| Task | Wave | Description |
|------|------|-------------|
| Correlation Terraform module | 3 | Parallel with other context Terraform |
| Domain models + ports | 4 | Interfaces and types |
| Rule evaluator + session manager | 5 | Core engine logic |
| Adapters + handlers | 6 | Wiring layer |
| Property tests | 7 | Correctness validation |
| Dashboard UI + API endpoints | 9 | With other Dashboard frontend work |

## 11. Future Enhancement Path

The architecture is designed so an LLM-based correlation fallback (Approach 3 from design exploration) can be added later as a separate Lambda without changing the core engine:

- A scheduled Lambda (every 5 minutes) collects items that didn't match any rule but arrived in temporal proximity
- Sends batch to Bedrock for "is there a relationship here?" evaluation
- If relationships found, creates sessions/groups through the same Session Manager
- Controlled cost (batch, not per-item), controlled latency (5-minute cadence, acceptable for non-obvious correlations)

This is explicitly out of scope for the initial build but the domain ports and session management support it without modification.

# Playbook Composition — Chaining Runbooks into Multi-Step Workflows — Design Specification

**Date:** 2026-06-08
**Author:** Matt Rogers + Kiro
**Status:** Draft → Pending Approval

---

## 1. Overview

The Knowledge Base stores individual runbooks as atomic procedures — "reset password", "check DNS propagation", "restart print spooler." But real SysAdmin work often requires chaining multiple procedures together with conditional logic. "Migrate mailbox" requires: pre-flight checks → DNS update → mailbox move → post-migration validation → cleanup.

This feature introduces Playbooks — reusable workflow compositions that chain existing runbooks (and other playbooks) into higher-level operations with simple conditional branching. Team leads author playbooks through the Dashboard, and the Planning agent uses them as composable building blocks when generating execution plans. A frequency-based pattern detector surfaces recurring successful runbook sequences as playbook suggestions.

## 2. Key Decisions

- **Authoring:** Team leads create playbooks manually + Planning agent suggests new ones based on recurring patterns. Agent suggestions require team lead approval.
- **Conditional logic:** Simple per-step conditionals (on-failure: halt, alternative, skip-to, continue). Not a full DAG or workflow engine.
- **Agent usage:** Playbooks as building blocks — the Planning agent references them as "macro steps" in plans alongside custom steps. Playbook internal sequence is respected; agent creativity applies at the plan composition level.
- **Pattern detection:** Frequency-based — same runbook sequence in 5+ successful plans triggers a suggestion. Extends Spec 2's feedback aggregator.
- **Architecture:** New document type in Knowledge Base context. Expansion logic in Execution context. Pattern detection in Orchestration aggregator.

## 3. Playbook Data Model

### 3.1 Playbook Structure

```typescript
interface Playbook {
  id: string;
  title: string;
  description: string;
  version: number;
  status: 'draft' | 'active' | 'deprecated';
  source: 'team-lead' | 'agent-suggested';
  approvedBy?: string;

  applicability: {
    categories: string[];
    keywords: string[];
    riskLevels: ('low' | 'medium' | 'high')[];
  };

  parameters: PlaybookParameter[];
  steps: PlaybookStep[];

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  successRate: number;
}

interface PlaybookParameter {
  name: string;
  type: 'string' | 'server' | 'user' | 'service' | 'path';
  required: boolean;
  description: string;
}

interface PlaybookStep {
  stepNumber: number;
  type: 'runbook' | 'inline' | 'playbook';

  runbookId?: string;
  runbookVersion?: number | 'latest';

  inlineCommand?: string;
  inlineDescription?: string;

  playbookId?: string;

  parameterMapping?: Record<string, string>;
  onFailure: FailureAction;
  expectedOutcome?: string;
}

interface FailureAction {
  action: 'halt' | 'alternative' | 'skip-to' | 'continue';
  alternativeRunbookId?: string;
  alternativePlaybookId?: string;
  skipToStep?: number;
  resumeAt?: number | 'next' | 'end';
  notifyOnFailure: boolean;
}
```

### 3.2 Storage

```
s3://forgeadmin-storage-{env}/
├── runbooks/              (existing)
└── playbooks/
    ├── {playbookId}/v{version}.json
    └── suggestions/{suggestionId}.json
```

### 3.3 DynamoDB Index (KB context)

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | `PLAYBOOK#{playbookId}` | Partition key |
| SK | `META` or `VERSION#{version}` | Sort key |
| status | String | draft/active/deprecated |
| source | String | team-lead/agent-suggested |
| categories | StringSet | Applicable categories |
| title | String | Human-readable name |
| currentVersion | Number | Latest version |
| usageCount | Number | Times used in plans |
| successRate | Number | From feedback data |

**GSI-1:** `status-category-index` — "all active playbooks for category X"
**GSI-2:** `source-status-index` — "all agent-suggested playbooks pending approval"

## 4. Planning Agent Integration

### 4.1 Enhanced KB Port

```typescript
interface IKnowledgeBase {
  // Existing
  queryKnowledge(query: string, limit: number): Promise<KnowledgeItem[]>;

  // New
  getApplicablePlaybooks(category: string, keywords: string[], riskLevel: string): Promise<Playbook[]>;
}
```

### 4.2 Plan Generation Flow

```
1. Triage classifies work item (existing)
2. Research queries KB for relevant runbooks (existing)
3. Research also fetches applicable playbooks by category/keywords
4. Planning agent receives: work item + research results + applicable playbooks
5. Planning agent generates plan using playbook-ref steps + custom steps
6. Plan published with step type indicators
```

### 4.3 Enhanced Plan Step

```typescript
interface PlanStep {
  stepNumber: number;
  type: 'custom' | 'playbook-ref';

  // For type: 'custom' (existing)
  description?: string;
  command?: string;
  expectedOutcome?: string;
  rollback?: string;

  // For type: 'playbook-ref'
  playbookId?: string;
  playbookVersion?: number | 'latest';
  parameterValues?: Record<string, string>;
}
```

### 4.4 Prompt Injection

```markdown
## Available Playbooks

**playbook-password-reset** (v3, 94% success rate, used 47 times)
Applicable for: account/service-request, keywords: password, lockout, reset
Steps: 1. Check replication health → 2. Unlock account → 3. Reset password → 4. Verify login
Parameters: targetUser (required), domain (optional, default: odot.ohio.gov)

**playbook-dns-record-update** (v2, 88% success rate, used 23 times)
Applicable for: account/service-request, keywords: DNS, CNAME, A record
Steps: 1. Verify zone → 2. Backup records → 3. Apply change → 4. Wait TTL → 5. Verify propagation
Parameters: zone (required), recordName (required), recordType (required), recordValue (required)

**Instruction:** Reference available playbooks as playbook-ref steps rather than writing
individual commands. Playbook internal steps execute as a unit with their own conditional logic.
Add custom steps before, after, or between playbook references as needed.
```

## 5. Execution Expansion

### 5.1 Expansion Logic

When Execution receives a plan with `playbook-ref` steps:

```
Plan as proposed:
  Step 1: [custom] Notify team of upcoming change
  Step 2: [playbook-ref] playbook-password-reset(targetUser=jsmith)
  Step 3: [custom] Update ServiceNow ticket

Expanded at execution time:
  Step 1: Notify team of upcoming change
  Step 2.1: Check replication health (from playbook)
  Step 2.2: Unlock account (from playbook)
  Step 2.3: Reset password (from playbook)
  Step 2.4: Verify login (from playbook)
  Step 3: Update ServiceNow ticket
```

### 5.2 Key Rules

- Expansion happens AFTER approval, BEFORE execution starts
- Playbook onFailure logic governs failures within the playbook
- If playbook-level result is "failed" (all conditional paths exhausted), plan-level halt kicks in
- Nesting depth limit: max 3 levels
- Circular reference detection: validated at playbook creation time
- Expanded plan is what gets executed and tracked in audit trail

### 5.3 Conditional Logic Execution

```
Step 2.1: Check replication health
  → SUCCESS → proceed to 2.2
  → FAILURE (onFailure: alternative, alternativeRunbook: manual-replication-fix)
    → Run manual-replication-fix
      → SUCCESS → resume at 2.2
      → FAILURE → playbook-level FAIL → plan HALT
Step 2.2: Unlock account
  → SUCCESS → proceed to 2.3
  → FAILURE (onFailure: halt, notifyOnFailure: true)
    → Notify Teams/Slack
    → playbook-level FAIL → plan HALT
```

## 6. Pattern Detection & Suggestions

### 6.1 Detection Logic (aggregator extension)

```
1. Query feedback-index for all successful plans in last 90 days
2. Extract kbItemsUsed sequences (ordered by step number)
3. Find sequences of 3+ runbooks appearing in 5+ successful plans
4. Filter out sequences already mapped to an existing active playbook
5. For each new pattern:
   a. Generate PlaybookSuggestion with pre-filled draft
   b. Store in S3: playbooks/suggestions/{suggestionId}.json
   c. Index in DynamoDB with status: 'pending'
   d. Publish playbook.suggestion-created event
```

### 6.2 Suggestion Structure

```typescript
interface PlaybookSuggestion {
  id: string;
  detectedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'dismissed';

  pattern: {
    runbookSequence: string[];
    occurrences: number;
    successRate: number;
    categories: string[];
    examplePlanIds: string[];
  };

  suggestedPlaybook: Partial<Playbook>;

  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}
```

### 6.3 Configurable Thresholds (via Steering)

- Minimum runbook sequence length: 3
- Minimum occurrences: 5
- Minimum success rate: 80%
- Maximum suggestions per run: 3

## 7. Dashboard UI

### 7.1 Playbook Management Page

List of all playbooks (active, draft, deprecated). Shows: title, categories, usage count, success rate, version, source. Click to edit.

### 7.2 Playbook Editor

Structured form:
- Metadata: title, description, categories, keywords, parameters
- Step builder: drag-and-drop runbook selection from KB, inline steps, nested playbook references
- Per-step conditional logic: on-failure dropdown (halt / alternative / skip-to / continue)
- Parameter mapping UI
- Preview: shows expanded step sequence
- Validation: circular reference check, nesting depth, runbook existence

### 7.3 Suggestions Queue (team_lead only)

Pending agent-suggested playbooks. Shows: detected pattern, occurrence count, success rate, example plans, pre-filled draft. Actions: Approve, Edit & Approve, Reject (with reason), Dismiss.

### 7.4 Playbook Usage Dashboard

Per-playbook metrics: usage count over time, success rate trend, which plans used it, average confidence when playbook involved.

### 7.5 API Endpoints

```
GET    /playbooks                        # List all (filterable by status, category)
POST   /playbooks                        # Create (team_lead only)
GET    /playbooks/:id                    # Get with current content
GET    /playbooks/:id/versions           # List versions
GET    /playbooks/:id/versions/:version  # Get specific version
PUT    /playbooks/:id                    # Update (new version, team_lead only)
DELETE /playbooks/:id                    # Deprecate (team_lead only)
POST   /playbooks/:id/validate          # Validate structure
GET    /playbooks/:id/usage             # Usage metrics

GET    /playbook-suggestions            # List pending (team_lead only)
POST   /playbook-suggestions/:id/approve  # Approve → creates active playbook
POST   /playbook-suggestions/:id/reject   # Reject with reason
POST   /playbook-suggestions/:id/dismiss  # Dismiss
```

**RBAC:** `team_lead` for CRUD + approve/reject. `team_member` read-only.

## 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| Playbook references non-existent runbook | Validation error at creation time. Cannot save. |
| Referenced runbook deprecated after playbook creation | Warning in Dashboard. Playbook executes but step marked "using deprecated runbook." |
| Circular reference (A → B → A) | Validation error at creation time. Cannot save. |
| Nesting depth exceeds 3 | Validation error at creation time. Cannot save. |
| Playbook expansion fails (runbook deleted) | Halt plan. Mark failed. Notify team lead. |
| Required parameter missing at plan time | Planning agent flags: "parameter could not be determined — manual input required." Plan goes to approval with warning. |
| Agent suggests playbook similar to existing (80%+ overlap) | Suggestion suppressed. Not surfaced. |
| Playbook step fails, alternative also fails | Escalate to playbook-level failure. Plan halt. |
| Playbook version pinned but version deleted | Fall back to latest version. Log warning. |

## 9. New Events

```
contracts/events/knowledge-base/playbook.created.schema.json
contracts/events/knowledge-base/playbook.updated.schema.json
contracts/events/orchestration/playbook.suggestion-created.schema.json
```

**`playbook.suggestion-created`:**

```json
{
  "source": "forgeadmin.orchestration",
  "detail-type": "playbook.suggestion-created",
  "detail": {
    "version": "1.0",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "payload": {
      "suggestionId": "uuid",
      "pattern": {
        "runbookSequence": ["runbook-check-replication", "runbook-unlock-account", "runbook-reset-password"],
        "occurrences": 7,
        "successRate": 0.86,
        "categories": ["account/service-request"]
      },
      "suggestedTitle": "Password Reset with Replication Check"
    }
  }
}
```

## 10. Infrastructure

### 10.1 Knowledge Base Context (additions)

- New S3 paths: `playbooks/{playbookId}/`, `playbooks/suggestions/`
- New DynamoDB entries (or table): playbook index with GSIs
- New Lambda: `playbook-query-handler` (returns applicable playbooks)
- Playbook validation logic (circular refs, nesting, existence checks)

### 10.2 Orchestration Context (additions)

- Pattern detection logic in feedback aggregator (hourly job extension)
- Enhanced Research agent: fetches playbooks alongside runbooks
- Enhanced Planning agent prompt: includes applicable playbooks
- Enhanced IKnowledgeBase port: `getApplicablePlaybooks` method

### 10.3 Execution Context (additions)

- Playbook expansion logic: resolves playbook-ref → concrete substeps
- Enhanced execution orchestrator: understands playbook onFailure conditional logic
- Handles nested expansion (max 3 depth)

### 10.4 Dashboard Context (additions)

- Playbook management API endpoints
- Playbook editor UI (structured form + drag-and-drop)
- Suggestions queue UI
- Usage metrics view

## 11. Testing Strategy

| Level | What | Approach |
|-------|------|----------|
| Unit | Validation (circular refs, nesting, parameters) | Vitest |
| Unit | Expansion (ref → substeps, nested expansion) | Vitest |
| Unit | Pattern detection (frequency, overlap filtering) | Vitest |
| Property | Expansion always produces flat sequence with no playbook-ref remaining | fast-check |
| Property | Circular reference detector catches all cycles | fast-check |
| Property | Nesting depth never exceeds 3 after expansion | fast-check |
| Property | All required parameters resolved after expansion | fast-check |
| Contract | Event schemas | JSON Schema validation |
| Integration | Pattern → suggestion → approval → agent uses playbook | LocalStack |

## 12. Execution Order

| Task | Wave | Description |
|------|------|-------------|
| Playbook data model + S3/DynamoDB (KB) | 6 | Storage |
| Playbook validation logic (KB) | 6 | Circular refs, nesting checks |
| Playbook query handler (KB) | 6 | Returns applicable playbooks |
| Playbook expansion logic (Execution) | 7 | Resolves refs to substeps |
| Planning agent enhancement (Orchestration) | 7 | Uses playbooks as blocks |
| Pattern detection (Orchestration aggregator) | 8 | Surfaces suggestions |
| Playbook management API (Dashboard) | 8 | CRUD endpoints |
| Playbook editor + suggestions UI (Dashboard) | 9 | Frontend |
| Property tests | 8 | Correctness validation |

## 13. Relationship to Other Enhancement Specs

- **Spec 1 (Incident Correlation):** Correlated groups that produce merged parent work items can trigger playbooks designed for multi-system issues (e.g., "rack-level investigation playbook").
- **Spec 2 (Feedback Loop):** Playbook usage is tracked in feedback entries. Success/failure of playbook-based plans feeds back into playbook success rate metrics and pattern detection.
- **Spec 3 (Dry-Run):** Static analysis expands playbook-ref steps before generating the preview. Operators see the full expanded diff, not just "run playbook X."
- **Spec 4 (Calibration):** Plans using well-tested playbooks (high usage count, high success rate) may have higher confidence — calibration data confirms this over time.

# Task Group 16: Playbook Composition — Chaining Runbooks into Workflows

**Bounded Context:** Knowledge Base (storage + validation) + Orchestration (pattern detection + agent usage) + Execution (expansion) + Dashboard (UI)
**Internal Pattern:** Simple Lambda handlers + domain logic in KB and Execution contexts
**Dependencies:** Task Group 05 (KB infrastructure + runbooks), Task Group 04 (Orchestration agents), Task Group 06 (Execution layer), Task Group 13 (Feedback Loop — provides usage data for pattern detection)
**Design Spec:** `docs/superpowers/specs/2026-06-08-playbook-composition-design.md`

---

## Tasks

- [ ] 17.1 Add playbook infrastructure to Knowledge Base Terraform module
  - Modify `terraform/contexts/knowledge-base/dynamodb.tf`: add `playbook-index` table with GSIs (`status-category-index`, `source-status-index`), `force_destroy = true`, on-demand capacity
  - Modify `terraform/contexts/knowledge-base/s3.tf`: add lifecycle rules for `playbooks/` and `playbooks/suggestions/` prefixes in existing storage bucket
  - Modify `terraform/contexts/knowledge-base/lambda.tf`: add `playbook-query-handler` Lambda, `playbook-validation` Lambda
  - Modify `terraform/contexts/knowledge-base/iam.tf`: playbook Lambda roles with DynamoDB read/write, S3 read/write
  - _Design Spec: Section 10.1_

- [ ] 17.2 Define event schemas for playbook system
  - Create `contracts/events/knowledge-base/playbook.created.schema.json`: playbookId, title, version, source, categories, stepCount
  - Create `contracts/events/knowledge-base/playbook.updated.schema.json`: playbookId, title, previousVersion, newVersion, updatedBy
  - Create `contracts/events/orchestration/playbook.suggestion-created.schema.json`: suggestionId, pattern (runbookSequence, occurrences, successRate, categories), suggestedTitle
  - Validate schemas conform to EventEnvelope standard
  - Register schemas in EventBridge Schema Registry
  - _Design Spec: Section 9_

- [ ] 17.3 Implement playbook domain models
  - Create `src/contexts/knowledge-base/domain/models/playbook.ts`: Playbook, PlaybookParameter, PlaybookStep, FailureAction interfaces
  - Create `src/contexts/knowledge-base/domain/models/playbook-suggestion.ts`: PlaybookSuggestion interface with pattern, suggestedPlaybook, review status
  - Create `src/contexts/knowledge-base/domain/models/playbook-validators.ts`: validation rules — circular reference detection (DFS graph traversal), nesting depth check (max 3), required parameter completeness, runbook existence verification
  - _Design Spec: Sections 3.1, 6.2_

- [ ] 17.4 Implement playbook validation logic
  - Create `src/contexts/knowledge-base/handlers/playbook-validation.ts`
  - Circular reference detection: build directed graph of playbook → nested playbook references, DFS for cycles
  - Nesting depth check: recursively expand playbook refs, error if any path exceeds 3 levels
  - Runbook existence check: verify all referenced runbookIds exist and are active in KB
  - Parameter completeness: verify all required parameters of referenced runbooks/playbooks are mapped
  - Return validation result with specific error messages for each violation
  - Called synchronously before save (both API create and API update)
  - _Design Spec: Sections 5.2, 8_

- [ ] 17.5 Implement playbook query handler
  - Create `src/contexts/knowledge-base/handlers/playbook-query-handler.ts`
  - Query `playbook-index` by status=active + category match (GSI-1)
  - Filter by keyword overlap and riskLevel
  - Return ranked list: higher usageCount + higher successRate = higher rank
  - Include full playbook structure with step details for prompt injection
  - Handle empty results gracefully
  - _Design Spec: Section 4.1_

- [ ] 17.6 Implement playbook storage operations
  - Create `src/contexts/knowledge-base/handlers/playbook-crud.ts`:
    - Create: validate → write to S3 (`playbooks/{id}/v{version}.json`) → write DynamoDB index → publish `playbook.created` event
    - Update: validate → write new version to S3 → update DynamoDB index (currentVersion) → publish `playbook.updated` event
    - Deprecate: update DynamoDB status to 'deprecated', do not delete S3 versions
    - Get: DynamoDB lookup → S3 fetch for full document
    - List versions: DynamoDB query by PK with SK prefix `VERSION#`
  - Implement version pinning: `latest` resolves to currentVersion at expansion time
  - _Design Spec: Sections 3.2, 3.3_

- [ ] 17.7 Enhance IKnowledgeBase port with playbook support
  - Modify `src/contexts/orchestration/domain/ports/IKnowledgeBase.ts`: add `getApplicablePlaybooks(category: string, keywords: string[], riskLevel: string): Promise<Playbook[]>`
  - Create `src/contexts/orchestration/adapters/knowledge-base-client.ts` modification: implement `getApplicablePlaybooks` by calling KB context's playbook-query-handler (via EventBridge request-response or direct Lambda invocation)
  - _Design Spec: Section 4.1_

- [ ] 17.8 Modify Planning agent to use playbooks as building blocks
  - Modify `src/contexts/orchestration/domain/agents/planning.ts`:
    - After Research phase, call `IKnowledgeBase.getApplicablePlaybooks()` with work item's category/keywords/riskLevel
    - Inject applicable playbooks into planning prompt (title, version, success rate, usage count, step summary, parameters)
    - Support `playbook-ref` step type in plan output: Planning agent can reference playbooks by ID with parameterValues
    - Validate that all required playbook parameters are filled
    - If parameter cannot be determined: flag step with warning "manual input required"
  - Modify plan model: add `type: 'custom' | 'playbook-ref'` to PlanStep interface
  - _Design Spec: Sections 4.2, 4.3, 4.4_

- [ ] 17.9 Implement playbook expansion in Execution context
  - Create `src/contexts/execution/domain/playbook-expander.ts`:
    - Input: plan with `playbook-ref` steps
    - For each playbook-ref: fetch playbook from KB, resolve version (latest or pinned), substitute parameterValues into step commands
    - Recursively expand nested playbook references (respect max 3 depth)
    - Output: flat plan with all steps numbered hierarchically (2.1, 2.2, 2.3 for steps within a playbook)
    - Preserve onFailure conditional logic per expanded step
    - Handle expansion failures (deleted runbook, missing playbook): halt with clear error message
  - Modify `src/contexts/execution/domain/execution-orchestrator.ts`: call playbook-expander after approval, before execution begins
  - _Design Spec: Sections 5.1, 5.2, 5.3_

- [ ] 17.10 Implement conditional logic execution in Execution context
  - Modify `src/contexts/execution/domain/execution-orchestrator.ts`:
    - On step failure, evaluate step's onFailure action:
      - `halt`: stop playbook execution, mark playbook as failed
      - `alternative`: execute alternative runbook/playbook, then resume at specified step
      - `skip-to`: jump to specified step number, continue from there
      - `continue`: log failure, proceed to next step
    - `notifyOnFailure`: if true, publish notification event for Communication context
    - If all conditional paths within a playbook exhaust: escalate to plan-level failure (existing halt logic)
  - _Design Spec: Section 5.3_

- [ ] 17.11 Implement pattern detection for playbook suggestions
  - Modify `src/contexts/orchestration/handlers/feedback-aggregator.ts` (extends Task Group 13):
    - After standard aggregation, add pattern detection step
    - Query `feedback-index` for successful plans in last 90 days that used 3+ KB items
    - Extract ordered runbook ID sequences from `kbItemsUsed` field
    - Find sequences appearing in 5+ successful plans with 80%+ success rate
    - Filter out sequences already covered by active playbooks (80%+ overlap check)
    - For each new pattern (max 3 per run):
      - Generate PlaybookSuggestion with pre-filled playbook draft
      - Write to S3: `playbooks/suggestions/{suggestionId}.json`
      - Write to DynamoDB with status=pending
      - Publish `playbook.suggestion-created` event
  - Thresholds configurable via Steering docs (min sequence length, min occurrences, min success rate, max suggestions per run)
  - _Design Spec: Sections 6.1, 6.2, 6.3_

- [ ] 17.12 Implement Dashboard API endpoints for playbook management
  - Create `src/contexts/dashboard/api/handlers/playbooks.ts`:
    - GET /playbooks: list all (filterable by status, category, source)
    - POST /playbooks: create (team_lead only, calls KB validation before save)
    - GET /playbooks/:id: get with current content
    - GET /playbooks/:id/versions: list all versions
    - GET /playbooks/:id/versions/:version: get specific version
    - PUT /playbooks/:id: update (team_lead only, creates new version)
    - DELETE /playbooks/:id: deprecate (team_lead only)
    - POST /playbooks/:id/validate: validate structure without saving
    - GET /playbooks/:id/usage: usage metrics (count, success rate, example plans)
  - Create `src/contexts/dashboard/api/handlers/playbook-suggestions.ts`:
    - GET /playbook-suggestions: list pending (team_lead only)
    - POST /playbook-suggestions/:id/approve: approve → creates active playbook
    - POST /playbook-suggestions/:id/reject: reject with reason
    - POST /playbook-suggestions/:id/dismiss: dismiss
  - Implement RBAC: team_lead for all write operations, team_member read-only
  - _Design Spec: Section 7.5_

- [ ] 17.13 Add playbook API to Dashboard Terraform module
  - Modify `terraform/contexts/dashboard/lambda.tf`: add playbook handler Lambda, playbook-suggestions handler Lambda
  - Modify `terraform/contexts/dashboard/api-gateway.tf`: add /playbooks/* and /playbook-suggestions/* routes with Cognito authorizer
  - Modify `terraform/contexts/dashboard/iam.tf`: playbook Lambdas need cross-context access to KB's playbook DynamoDB table and S3 paths
  - _Design Spec: Section 10.4_

- [ ] 17.14 Implement Playbook Management Dashboard UI
  - Create React component: `src/contexts/dashboard/frontend/views/PlaybookList.tsx` — list of all playbooks with status/category/usage/success rate columns, filterable
  - Create React component: `src/contexts/dashboard/frontend/views/PlaybookEditor.tsx`:
    - Metadata form: title, description, categories, keywords, risk levels, parameters
    - Step builder: drag-and-drop interface for adding runbook steps (searchable KB), inline steps, nested playbook references
    - Per-step onFailure configuration: dropdown (halt/alternative/skip-to/continue) with conditional fields
    - Parameter mapping UI: for each step, map playbook params to step params
    - Preview panel: shows expanded step sequence as it would execute
    - Validation button: calls /playbooks/:id/validate, displays errors inline
  - Create React component: `src/contexts/dashboard/frontend/views/PlaybookSuggestions.tsx` — pending agent suggestions with pattern visualization, approve/edit/reject/dismiss actions
  - Create React component: `src/contexts/dashboard/frontend/views/PlaybookUsage.tsx` — per-playbook metrics, usage over time, success rate trend
  - Add Zustand store slice: `playbooks` with list, editor state, suggestions, usage data
  - _Design Spec: Sections 7.1, 7.2, 7.3, 7.4_

- [ ]* 17.15 Write property tests for playbook system
  - **Property: Expansion completeness** — after expansion, no `playbook-ref` type steps remain in the output (fast-check with arbitrary playbook graph structures)
  - **Property: Circular reference detection** — validator catches all cycles in arbitrary playbook graphs (generate random DAGs with cycles injected)
  - **Property: Nesting depth enforcement** — expansion never exceeds 3 levels regardless of playbook structure
  - **Property: Parameter resolution** — all required parameters are resolved after expansion (no unsubstituted placeholders)
  - _Design Spec: Section 11_

- [ ]* 17.16 Write unit tests for playbook system
  - Test validation: circular refs caught, nesting depth enforced, missing runbooks detected, parameter completeness checked
  - Test expansion: simple playbook, nested playbook, parameter substitution, version resolution (latest vs pinned)
  - Test conditional logic: halt behavior, alternative execution and resume, skip-to navigation, continue on failure
  - Test pattern detection: frequency counting, overlap filtering, suggestion generation, threshold respect
  - Test API: CRUD operations, RBAC enforcement, version creation, deprecation
  - _Design Spec: Section 11_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 17.1, 17.2 | 6 |
| 17.3, 17.4, 17.5, 17.6 | 6 |
| 17.7, 17.8, 17.9, 17.10 | 7 |
| 17.11, 17.12, 17.13 | 8 |
| 17.14, 17.15, 17.16 | 9 |

---

## Cross-Context Integration Summary

| Context | Responsibility |
|---------|---------------|
| Knowledge Base | Playbook storage (S3 + DynamoDB), validation logic, query handler |
| Orchestration | Pattern detection (aggregator), Planning agent playbook usage, IKnowledgeBase port extension |
| Execution | Playbook expansion (ref → substeps), conditional logic execution within expanded plans |
| Dashboard | CRUD API, editor UI, suggestions queue, usage metrics |
| Communication | Subscribes to `playbook.suggestion-created` → notifies team leads of new suggestions |

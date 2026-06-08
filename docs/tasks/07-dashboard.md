# Task Group 07: Dashboard & API Context

**Bounded Context:** Dashboard & API
**Internal Pattern:** React SPA + Lambda API
**Dependencies:** Task Group 01 (Cognito, foundation), Task Group 02 (OpenAPI spec)
**Terraform State:** `forgeadmin/dashboard/terraform.tfstate`

---

## Tasks

- [ ] 10.1 Create Dashboard Terraform module
  - Create `terraform/contexts/dashboard/main.tf` with S3 backend key `forgeadmin/dashboard/terraform.tfstate`
  - Create `terraform/contexts/dashboard/s3-cloudfront.tf`: S3 bucket for SPA, CloudFront distribution
  - Create `terraform/contexts/dashboard/api-gateway.tf`: REST API Gateway with Cognito authorizer, WebSocket API
  - Create `terraform/contexts/dashboard/dynamodb.tf`: module config and approvals table with GSIs (`state-index`, `approval-status-index`), `force_destroy = true`
  - Create `terraform/contexts/dashboard/lambda.tf`: API handler Lambdas, WebSocket connection handler
  - Create `terraform/contexts/dashboard/iam.tf`: API Gateway, Lambda, DynamoDB roles
  - _Requirements: 11.1, 11.5, 15.1, 15.2_

- [ ] 10.2 Implement Dashboard API Lambda handlers
  - Create `src/contexts/dashboard/api/handlers/modules.ts`: GET /modules, PATCH /modules/:id/state, PATCH /modules/:id/config
  - Create `src/contexts/dashboard/api/handlers/approvals.ts`: GET /approvals/pending, POST /approvals/:id/decision
  - Create `src/contexts/dashboard/api/handlers/executions.ts`: GET /executions (filterable by module, date, risk, outcome)
  - Create `src/contexts/dashboard/api/handlers/audit.ts`: GET /audit (filterable audit trail)
  - Implement RBAC middleware: admin (full access), viewer (read-only)
  - Implement request validation from OpenAPI spec
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 10.3 Implement module state management and promotion logic
  - Create `src/contexts/dashboard/domain/module-manager.ts`: state transitions (enabled/disabled/shadow), 300-second grace period on disable, force-stop after grace period
  - Create `src/contexts/dashboard/domain/promotion-manager.ts`: manual vs auto-suggest promotion, accuracy metrics, evaluation window
  - Publish `module.state-changed` events on transitions
  - Log promotion rejections, enforce 365-day retention for promotion history
  - _Requirements: 9.1-9.6, 10.1-10.6_

- [ ]* 10.4 Write property tests for module state management — State machine validity
  - **Property 4: State machine validity** — Only valid transitions occur; concurrent operations don't corrupt state
  - Use fast-check to generate sequences of state transitions and verify invariants
  - **Validates: Requirements 9.1, 9.4, 9.5, 9.6**

- [ ] 10.5 Implement WebSocket real-time updates
  - Create `src/contexts/dashboard/websocket/connection-handler.ts`: manage WebSocket connections in DynamoDB
  - Create `src/contexts/dashboard/websocket/event-fan.ts`: EventBridge → WebSocket fan-out for module state changes, approvals, execution events
  - Implement 5-second refresh guarantee for state changes
  - _Requirements: 11.1, 11.3_

- [ ] 10.6 Implement React SPA frontend
  - Initialize Vite + React + TypeScript project in `src/contexts/dashboard/frontend/`
  - Create Zustand store with slices: modules, approvals, executions, audit, websocket
  - Implement module dashboard view: state, confidence scores, last execution, state toggle controls
  - Implement approval queue view: pending approvals with confidence, justification, plan, risk level, ticket link
  - Implement execution history view: filterable by module, date, risk, outcome (90-day history)
  - Implement module configuration view: confidence threshold (0-100), promotion strategy, evaluation window
  - Implement RBAC-aware UI: hide modification controls for viewer role
  - Auto-generate TypeScript types from OpenAPI spec
  - Integrate WebSocket for real-time updates
  - _Requirements: 11.1-11.6, 10.1, 10.5_

- [ ]* 10.7 Write unit tests for Dashboard API and domain logic
  - Test RBAC enforcement (admin vs viewer access)
  - Test module state transitions and grace period logic
  - Test promotion strategy logic (manual vs auto-suggest)
  - Test approval workflow (approve, reject, SLA timeout)
  - _Requirements: 9.1-9.6, 10.1-10.6, 11.1-11.6_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 10.1 | 3 |
| 10.2, 10.3, 10.5 | 8 |
| 10.4, 10.6, 10.7 | 9 |

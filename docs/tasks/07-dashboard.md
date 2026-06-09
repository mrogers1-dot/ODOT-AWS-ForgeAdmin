# Task Group 07: Dashboard & API Context

**Bounded Context:** Dashboard & API
**Internal Pattern:** React SPA + Lambda API
**Dependencies:** Task Group 01 (Cognito, foundation), Task Group 02 (OpenAPI spec)
**Terraform State:** `forgeadmin/dashboard/terraform.tfstate`

---

## Tasks

- [x] 10.1 Create Dashboard Terraform module
  - **RED**: Write a `terraform validate` check for the dashboard context module
  - **GREEN**: Create `terraform/contexts/dashboard/main.tf` with S3 backend key `forgeadmin/dashboard/terraform.tfstate`. Create `terraform/contexts/dashboard/s3-cloudfront.tf`: S3 bucket for SPA, CloudFront distribution. Create `terraform/contexts/dashboard/api-gateway.tf`: REST API Gateway with Cognito authorizer, WebSocket API. Create `terraform/contexts/dashboard/dynamodb.tf`: module config and approvals table with GSIs (`state-index`, `approval-status-index`), `force_destroy = true`. Create `terraform/contexts/dashboard/lambda.tf`: API handler Lambdas, WebSocket connection handler. Create `terraform/contexts/dashboard/iam.tf`: API Gateway, Lambda, DynamoDB roles.
  - **REFACTOR**: Validate CORS configuration; ensure CloudFront cache invalidation is documented
  - _Requirements: 11.1, 11.5, 15.1, 15.2_

- [x] 10.2 Implement Dashboard API Lambda handlers
  - **RED**: Write tests: (1) GET /modules returns all modules with state, (2) PATCH /modules/:id/state changes state with valid transition, (3) PATCH /modules/:id/config updates config within constraints, (4) GET /approvals/pending returns pending items, (5) POST /approvals/:id/decision records decision and publishes event, (6) viewer role cannot modify resources (403), (7) admin role has full access
  - **GREEN**: Create `src/contexts/dashboard/api/handlers/modules.ts`: GET /modules, PATCH /modules/:id/state, PATCH /modules/:id/config. Create `src/contexts/dashboard/api/handlers/approvals.ts`: GET /approvals/pending, POST /approvals/:id/decision. Create `src/contexts/dashboard/api/handlers/executions.ts`: GET /executions (filterable by module, date, risk, outcome). Create `src/contexts/dashboard/api/handlers/audit.ts`: GET /audit (filterable audit trail). Implement RBAC middleware: admin (full access), viewer (read-only). Implement request validation from OpenAPI spec.
  - **REFACTOR**: Extract RBAC middleware into shared module; ensure all error responses follow consistent format
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 10.3 Implement module state management and promotion logic
  - **RED**: Write tests: (1) valid state transition succeeds, (2) invalid state transition fails, (3) disable triggers 300-second grace period, (4) force-stop after grace period halts in-flight, (5) manual promotion requires team_lead, (6) auto-suggest promotion records metrics, (7) promotion rejection is logged with 365-day retention
  - **GREEN**: Create `src/contexts/dashboard/domain/module-manager.ts`: state transitions (enabled/disabled/shadow), 300-second grace period on disable, force-stop after grace period. Create `src/contexts/dashboard/domain/promotion-manager.ts`: manual vs auto-suggest promotion, accuracy metrics, evaluation window. Publish `module.state-changed` events on transitions. Log promotion rejections, enforce 365-day retention for promotion history.
  - **REFACTOR**: Extract state machine into pure function; ensure grace period timer is testable (injectable clock)
  - _Requirements: 9.1-9.6, 10.1-10.6_

- [x] 10.4 Write property tests for module state management — State machine validity
  - **RED**: Write fast-check property test: Only valid transitions occur; concurrent operations don't corrupt state
  - **GREEN**: Implement generators for state transition sequences; run property tests and fix violations
  - **REFACTOR**: Ensure generators cover all state combinations; add shrinking for minimal failing cases
  - _Validates: Requirements 9.1, 9.4, 9.5, 9.6_

- [x] 10.5 Implement WebSocket real-time updates
  - **RED**: Write tests: (1) WebSocket connection is stored in DynamoDB, (2) disconnect removes connection, (3) event fan-out sends to all active connections, (4) stale connections are cleaned up, (5) state change reaches client within 5 seconds
  - **GREEN**: Create `src/contexts/dashboard/websocket/connection-handler.ts`: manage WebSocket connections in DynamoDB. Create `src/contexts/dashboard/websocket/event-fan.ts`: EventBridge → WebSocket fan-out for module state changes, approvals, execution events. Implement 5-second refresh guarantee for state changes.
  - **REFACTOR**: Add heartbeat mechanism (30s); implement automatic reconnection with exponential backoff
  - _Requirements: 11.1, 11.3_

- [x] 10.6 Implement React SPA frontend
  - **RED**: Write tests: (1) module dashboard renders module state and confidence, (2) approval queue shows pending items with risk badges, (3) RBAC hides modification controls for viewer role, (4) WebSocket reconnects after disconnect
  - **GREEN**: Initialize Vite + React + TypeScript project in `src/contexts/dashboard/frontend/`. Create Zustand store with slices: modules, approvals, executions, audit, websocket. Implement module dashboard view: state, confidence scores, last execution, state toggle controls. Implement approval queue view: pending approvals with confidence, justification, plan, risk level, ticket link. Implement execution history view: filterable by module, date, risk, outcome (90-day history). Implement module configuration view: confidence threshold (0-100), promotion strategy, evaluation window. Implement RBAC-aware UI: hide modification controls for viewer role. Auto-generate TypeScript types from OpenAPI spec. Integrate WebSocket for real-time updates.
  - **REFACTOR**: Extract common components (risk badges, state indicators); ensure accessibility compliance
  - _Requirements: 11.1-11.6, 10.1, 10.5_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 10.1 | 3 |
| 10.2, 10.3, 10.5 | 8 |
| 10.4, 10.6 | 9 |

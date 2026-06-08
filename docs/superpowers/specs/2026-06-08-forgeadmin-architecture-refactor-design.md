# ForgeAdmin Platform Architecture Refactor — Design Specification

**Date:** 2026-06-08
**Author:** Matt Rogers + Kiro
**Status:** Draft → Pending Approval

---

## 1. Overview

ForgeAdmin is an agentic multi-agent Windows SysAdmin platform for the ODOT Windows Server team. This design document defines the architectural decomposition, communication patterns, data strategies, testing philosophy, and documentation standards that will govern the platform's implementation.

The platform is decomposed into 7 independently deployable bounded contexts communicating via an event-driven backbone. Each context owns its data, deploys via its own Terraform state, and can be destroyed/redeployed independently.

---

## 2. Bounded Contexts

| # | Context | Responsibility | Internal Pattern |
|---|---------|---------------|-----------------|
| 1 | **Ingestion** | Pulls incidents from ServiceNow, email (SES), FortiSIEM; normalizes into common work item format; publishes to event bus | Simple Lambda handlers |
| 2 | **Agent Orchestration** | Supervisor pattern: triage, research, planning, verification agents; confidence scoring; plan generation | Hexagonal (ports/adapters) |
| 3 | **Execution Layer** | Bridges AWS to on-prem jump server; JEA/MXC sandbox; single-concurrency execution; rollback management | Hexagonal (ports/adapters) |
| 4 | **Knowledge Base** | Bedrock KB management; RAG retrieval; runbook generation and storage; knowledge gap tracking | Simple Lambda handlers |
| 5 | **Dashboard & API** | React SPA; module management; approval workflows; metrics visualization; RBAC enforcement | React SPA + Lambda API |
| 6 | **Communication** | Teams/Slack notifications; morning digest; natural language interaction; notification retry/escalation | Simple Lambda handlers |
| 7 | **Platform/Infra** | Terraform foundation; observability; audit trail; CI/CD; cross-cutting shared infrastructure | Terraform modules |

### Context Independence Rules

- Each context has its own Terraform state file (separate S3 backend key)
- Each context can be `terraform destroy`'d individually without affecting others
- Contexts communicate exclusively via EventBridge events (no direct Lambda-to-Lambda calls)
- Each context owns its DynamoDB tables and S3 buckets
- Shared infrastructure (EventBridge bus, VPC, Transit Gateway attachments) lives in the foundation layer

---

## 3. Event-Driven Communication

### 3.1 EventBridge Bus

A single custom event bus (`forgeadmin-events`) shared across all contexts. Each context publishes events with a `source` field matching its context name.

### 3.2 Event Envelope Standard

```json
{
  "source": "forgeadmin.{context-name}",
  "detail-type": "{domain-object}.{action}",
  "detail": {
    "version": "1.0",
    "correlationId": "uuid-trace-id",
    "timestamp": "ISO-8601",
    "payload": { }
  }
}
```

### 3.3 Event Catalog

| Event | Source | Consumers |
|-------|--------|-----------|
| `work-item.created` | Ingestion | Orchestration |
| `triage.completed` | Orchestration | Orchestration (internal), Dashboard |
| `plan.proposed` | Orchestration | Dashboard, Communication |
| `plan.approved` | Dashboard | Execution |
| `plan.rejected` | Dashboard | Orchestration, Communication |
| `execution.completed` | Execution | Orchestration, Knowledge Base, Dashboard |
| `execution.failed` | Execution | Orchestration, Communication, Dashboard |
| `verification.completed` | Orchestration | Knowledge Base, Dashboard |
| `work-item.resolved` | Orchestration | Knowledge Base, Communication, Dashboard |
| `runbook.generated` | Knowledge Base | Communication, Dashboard |
| `kb.updated` | Knowledge Base | Dashboard |
| `module.state-changed` | Dashboard | Orchestration, Communication |
| `approval.decision` | Dashboard | Orchestration |
| `circuit-breaker.tripped` | Platform | Communication, Dashboard, Orchestration |
| `notification.sent` | Communication | Platform (audit) |
| `audit.entry-created` | Platform | (archival) |

### 3.4 SQS Buffering

| Queue | Consumer | Reason |
|-------|----------|--------|
| `forgeadmin-execution-queue` | Execution Layer | Safety: max concurrency = 1, retry isolation |
| `forgeadmin-communication-queue` | Communication | Rate limit isolation for Teams/Slack APIs |

All SQS queues have associated Dead Letter Queues (DLQ). Platform context monitors DLQ depth.

### 3.5 Contracts

- Every event type has a JSON Schema stored in `contracts/events/{context}/{event-name}.schema.json`
- Registered in EventBridge Schema Registry
- CI validates published events conform to their schema
- Breaking schema changes require version bump and consumer migration

---

## 4. Data Strategy

### 4.1 DynamoDB + S3 Tiered Storage

| Data Type | Store | TTL/Lifecycle |
|-----------|-------|---------------|
| Work items (active) | DynamoDB | 90 days, then archive to S3 |
| Agent state / plans | DynamoDB | 90 days |
| Module configuration | DynamoDB | No TTL (always hot) |
| Approval state | DynamoDB | 90 days |
| Execution state | DynamoDB | 90 days |
| Audit trail (hot) | DynamoDB | 90 days, then S3 |
| Audit trail (archive) | S3 (Glacier after 1yr) | 365+ days retention |
| Runbooks | S3 | No TTL |
| Notification state | DynamoDB | 30 days |

### 4.2 DynamoDB Design Principles

- Single-table design per context (GSIs for access patterns)
- Partition key design prevents hot partitions
- Point-in-time recovery enabled
- On-demand capacity (scales to zero for POC cost efficiency)

### 4.3 S3 Design Principles

- `force_destroy = true` in POC for clean teardown
- Versioning enabled for runbooks and audit
- Server-side encryption (SSE-S3)
- Lifecycle policies for Glacier transition

---

## 5. Agent Orchestration (Hexagonal Architecture)

### 5.1 Internal Structure

```
contexts/orchestration/
├── domain/
│   ├── agents/
│   │   ├── supervisor.ts         # Routes work items to appropriate agent
│   │   ├── triage.ts             # Classification logic
│   │   ├── research.ts           # KB query orchestration
│   │   ├── planning.ts           # Plan generation + confidence scoring
│   │   └── verification.ts       # Outcome validation
│   ├── models/                   # Domain entities (WorkItem, Plan, ConfidenceScore)
│   └── ports/                    # Interfaces
│       ├── IKnowledgeBase.ts
│       ├── IEventPublisher.ts
│       ├── IModelInvoker.ts
│       └── IStateStore.ts
├── adapters/
│   ├── bedrock-model.ts          # Implements IModelInvoker
│   ├── eventbridge-publisher.ts  # Implements IEventPublisher
│   ├── dynamodb-state.ts         # Implements IStateStore
│   └── knowledge-base-client.ts  # Implements IKnowledgeBase
├── handlers/                     # Lambda entry points (thin wiring)
│   ├── on-work-item-created.ts
│   ├── on-execution-completed.ts
│   └── step-function-tasks.ts
└── terraform/
```

### 5.2 Orchestration Pattern

AWS Step Functions coordinates the multi-agent flow:
1. Triage → 2. Research → 3. Planning → 4. Approval Gate (wait for callback) → 5. Execution (delegate to Execution context) → 6. Verification → 7. Documentation (delegate to KB context)

Each step invokes a Lambda that wires the appropriate domain agent to its adapters.

### 5.3 Model-Agnostic Design

The `IModelInvoker` port defines:
```typescript
interface IModelInvoker {
  invoke(prompt: string, config: ModelConfig): Promise<ModelResponse>;
}
```

Bedrock adapter implements it. Models can be swapped/chained without touching agent logic.

---

## 6. Execution Layer (Hexagonal + On-Prem Bridge)

### 6.1 Architecture

```
AWS Side:
  SQS Queue (max concurrency = 1)
    └── Lambda handler
         └── HTTPS (mTLS) via Transit Gateway → On-Prem API

On-Prem Side (Jump Server):
  MCP Server / REST API
    └── JEA constrained endpoints
    └── MXC Sandbox evaluation
    └── Callback to AWS API Gateway endpoint on completion
```

### 6.2 Key Design Decisions

- **Single concurrency:** Only one execution at a time on the jump server (safety constraint)
- **Callback pattern:** Jump server calls back to API Gateway when done (Lambda stays short-lived)
- **mTLS:** Certificates in AWS Secrets Manager, auto-rotated
- **10-minute timeout:** If no callback, mark as failed and notify
- **Halt-always-on-failure:** Any step failure halts the entire plan regardless of rollback success

---

## 7. Dashboard & API (Full-Stack)

### 7.1 Frontend

- React SPA (TypeScript, Vite)
- Hosted on S3 + CloudFront
- State management: Zustand
- Real-time: WebSocket via API Gateway WebSocket API
- Types auto-generated from OpenAPI spec

### 7.2 Backend

- API Gateway (REST) → Lambda (TypeScript)
- OpenAPI 3.1 as single source of truth
- Request validation middleware (generated from OpenAPI)
- RBAC middleware (Cognito JWT validation)

### 7.3 Authentication

- Cognito User Pool
- Roles: `admin` (server team), `viewer` (others)
- JWT validated at API Gateway authorizer level

### 7.4 Real-Time Updates

- API Gateway WebSocket API
- Platform context fans relevant EventBridge events to connected WebSocket clients
- Dashboard subscribes to: module state changes, new approvals, execution events

---

## 8. Terraform Layer Architecture

```
terraform/
├── foundation/              # Shared infra (deployed first, destroyed last)
│   ├── eventbridge.tf       # Custom event bus, schema registry
│   ├── networking.tf        # VPC, Transit Gateway attachments
│   ├── iam-shared.tf        # Cross-context IAM roles
│   ├── cognito.tf           # User pool (shared auth)
│   ├── s3-state.tf          # Terraform state bucket (bootstrapped separately)
│   └── outputs.tf           # SSM parameters for context discovery
├── contexts/
│   ├── ingestion/           # Own state file
│   ├── orchestration/       # Own state file
│   ├── execution/           # Own state file
│   ├── knowledge-base/      # Own state file
│   ├── dashboard/           # Own state file
│   ├── communication/       # Own state file
│   └── platform/            # Own state file
├── scripts/
│   ├── deploy-all.sh        # Deploy foundation → all contexts
│   ├── destroy-all.sh       # Destroy all contexts → foundation
│   └── destroy-context.sh   # Destroy single context by name
└── environments/
    ├── dev.tfvars
    └── staging.tfvars
```

### 8.1 Independence Rules

- Each context uses a separate S3 backend key: `forgeadmin/{context}/terraform.tfstate`
- Contexts discover shared resources via SSM Parameter Store lookups (not hardcoded ARNs)
- Foundation outputs EventBridge bus ARN, VPC ID, Cognito pool ID, etc. to SSM
- `force_destroy = true` on all stateful resources in POC (DynamoDB tables, S3 buckets)

### 8.2 Destroy/Rebuild

- **Single context:** `./scripts/destroy-context.sh orchestration`
- **Full account wipe:** `./scripts/destroy-all.sh` (destroys contexts in parallel, then foundation)
- **Full rebuild:** `./scripts/deploy-all.sh` (deploys foundation, then contexts in parallel)
- Deploy order: foundation first, contexts can deploy in parallel after
- Destroy order: contexts first (any order), foundation last

---

## 9. Observability

### 9.1 Stack

- **Logging:** Structured JSON → CloudWatch Logs (per Lambda/context)
- **Tracing:** AWS X-Ray (distributed traces across Step Functions, Lambda, EventBridge)
- **Metrics:** CloudWatch Metrics + custom metrics per context
- **Dashboards:** CloudWatch Dashboards (one per context + one platform overview)
- **Alarms:** CloudWatch Alarms → SNS → Communication context

### 9.2 Standards (every context must implement)

- Structured JSON log format with `correlationId`, `context`, `action`, `level`
- X-Ray tracing enabled on all Lambdas and API Gateways
- Custom metrics: invocation count, error count, duration percentiles
- DLQ depth alarm per queue

---

## 10. Testing Strategy

### 10.1 Testing Pyramid

| Level | What | Tools |
|-------|------|-------|
| Unit | Domain logic in isolation | Vitest, fast-check (property-based) |
| Contract | Event schemas, API contracts | JSON Schema validators, OpenAPI validators |
| Integration | Adapters against real AWS services | LocalStack, Vitest |
| E2E | Full workflow across contexts | Custom test harness, Step Functions Local |

### 10.2 Property-Based Testing (Correctness Properties)

| Property | Domain | Description |
|----------|--------|-------------|
| Classification completeness | Triage | Any valid work item produces exactly one category, one risk level, one urgency level |
| Confidence monotonicity | Planning | Higher KB relevance scores produce higher confidence scores |
| Plan boundedness | Planning | Every plan has ≤20 steps; every step has rollback OR manual flag |
| State machine validity | Modules | Only valid transitions occur; concurrent operations don't corrupt state |
| Circuit breaker determinism | Platform | After threshold failures, breaker always trips; no auto-executions after trip |
| Audit completeness | Platform | Every state transition produces exactly one audit entry |

### 10.3 Contract Testing

- CI validates: "Does my published event match the registered schema?"
- Consumer-driven: "Does the event I consume still have the fields I depend on?"
- Breaking changes caught before deploy

---

## 11. Documentation Standards

### 11.1 Repository Structure

```
docs/
├── README.md                          # Living project overview
├── QUICKSTART.md                      # Setup, deploy, first run
├── adr/
│   ├── 0001-event-driven-microservices.md
│   ├── 0002-eventbridge-plus-sqs-hybrid.md
│   ├── 0003-hexagonal-for-complex-contexts.md
│   ├── 0004-dynamodb-plus-s3-tiered-storage.md
│   ├── 0005-terraform-independent-state-per-context.md
│   ├── 0006-react-spa-serverless-dashboard.md
│   ├── 0007-aws-native-observability.md
│   ├── 0008-json-schema-openapi-contracts.md
│   └── template.md
├── contracts/
│   ├── events/{context}/{event}.schema.json
│   └── api/openapi.yaml
└── architecture/
    └── context-map.md
```

### 11.2 ADR Format

```markdown
# ADR-NNNN: Title

## Status
Accepted | Superseded | Deprecated

## Context
What is the issue that motivates this decision?

## Decision
What is the change that we're proposing/making?

## Consequences
What becomes easier or harder because of this decision?
```

### 11.3 ADR Trigger Criteria

Any decision that affects: AWS service selection, inter-context communication, data modeling, security/auth, testing strategy, deployment patterns, or technology choices.

---

## 12. Refactored Requirements Structure

Requirements are split by bounded context:

| Spec | Contains (from original) |
|------|--------------------------|
| `forgeadmin-platform/` | Cross-cutting: quality attributes, security baseline, observability standards, event contracts, deployment standards |
| `ingestion/` | Requirement 1 (incident ingestion) |
| `orchestration/` | Requirements 2-4, 7 (triage, research, planning, verification) |
| `execution/` | Requirements 5-6 (approval gates, sandboxed execution) |
| `knowledge-base/` | Requirement 8 (auto-documentation, KB updates) |
| `dashboard/` | Requirements 9-11 (modular architecture, promotion, management dashboard) |
| `communication/` | Requirement 12 (notifications, morning digest, Teams/Slack) |
| `platform-infra/` | Requirements 13-16 (security, reliability, IaC, POC validation) |

Each context's spec gets its own requirements → design → tasks cycle.

---

## 13. Implementation Order

Recommended build order (foundation up):

1. **Platform/Infra** — Terraform foundation, CI/CD pipeline, observability baseline
2. **Ingestion** — First event producer; proves EventBridge works
3. **Agent Orchestration** — Core brain; Step Functions + agents
4. **Knowledge Base** — Bedrock KB setup, RAG retrieval
5. **Execution Layer** — On-prem bridge (requires jump server setup)
6. **Dashboard & API** — Full-stack web app
7. **Communication** — Teams/Slack integration (can be built in parallel with 5-6)

Each builds on the foundation and proves one more link in the chain.

---

## 14. Security Architecture

- **Authentication:** Cognito (Dashboard users), mTLS (Execution ↔ Jump Server), IAM roles (inter-service)
- **Authorization:** RBAC via Cognito groups, enforced at API Gateway and Lambda middleware
- **Data protection:** Sensitive data redaction before LLM calls, SSE-S3 at rest, TLS in transit
- **Network:** All on-prem traffic via Transit Gateway, no public endpoints except CloudFront (Dashboard)
- **Secrets:** AWS Secrets Manager for mTLS certs, API keys; rotated automatically
- **Audit:** Append-only DynamoDB trail, archived to S3, retained 365+ days

---

## 15. Open Questions / Future Considerations

- **Strands Agents vs pure Step Functions:** The POC will evaluate whether Strands Agents within Bedrock AgentCore add value over plain Step Functions + Lambda for orchestration. ADR to be written after POC evaluation.
- **LangGraph:** Listed as an option in the original POC doc. Will be evaluated for complex multi-step workflows if Step Functions proves limiting.
- **MXC Sandbox:** Still under evaluation per original POC. The execution layer design accommodates both JEA-only and JEA+MXC patterns.

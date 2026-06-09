# ForgeAdmin Context Map

## Visual Map

```mermaid
graph TB
    subgraph Foundation["Platform Foundation"]
        EB["EventBridge Bus - forgeadmin-events"]
        VPC["VPC"]
        COG["Cognito"]
        IAM["IAM"]
    end

    subgraph Contexts["Bounded Contexts"]
        ING["Ingestion - ServiceNow, Email, FortiSIEM"]
        ORCH["Orchestration - Triage, Research, Plan, Verify"]
        EXEC["Execution - On-prem Bridge, mTLS + JEA"]
        KB["Knowledge Base - Bedrock RAG, Runbooks"]
        CORR["Correlation - Rule Evaluator, Session Manager"]
        DASH["Dashboard and API - React SPA, WebSocket, Cognito"]
        COMM["Communication - Teams, Slack, SES, 3-tier"]
        PLAT["Platform Services - Audit, Circuit Breaker, Archival"]
    end

    ING -->|"work-item.created"| EB
    EB -->|"work-item.created"| ORCH
    EB -->|"work-item.created"| CORR
    ORCH -->|"plan.proposed"| EB
    EB -->|"plan.proposed"| DASH
    DASH -->|"plan.approved or plan.rejected"| EB
    EB -->|"plan.approved"| ORCH
    ORCH -->|"execution.requested"| EXEC
    EXEC -->|"execution.completed or failed"| EB
    EB -->|"execution.completed"| ORCH
    ORCH -->|"work-item.resolved"| EB
    KB -->|"runbook.generated or kb.updated"| EB
    CORR -->|"correlation-group.detected"| EB
    COMM -->|"notification.sent or failed"| EB
    PLAT -->|"audit.entry-created or circuit-breaker.tripped"| EB
    EB -->|"all events"| PLAT
```

## Event Flows

### Happy Path: Work Item to Resolution

```mermaid
sequenceDiagram
    participant ING as Ingestion
    participant EB as EventBridge
    participant ORCH as Orchestration
    participant KB as Knowledge Base
    participant DASH as Dashboard
    participant EXEC as Execution
    participant CORR as Correlation

    ING->>EB: work-item.created
    EB->>ORCH: work-item.created
    EB->>CORR: work-item.created
    CORR->>CORR: Evaluate rules, manage session
    ORCH->>ORCH: Triage
    ORCH->>KB: Query for relevant runbooks
    KB-->>ORCH: kb.query.result
    ORCH->>ORCH: Research & Plan
    ORCH->>EB: plan.proposed
    EB->>DASH: plan.proposed (render for approval)
    DASH->>EB: plan.approved
    EB->>ORCH: plan.approved
    ORCH->>EXEC: execution.requested
    EXEC->>EXEC: Execute via mTLS/on-prem bridge (Transit GW + JEA)
    EXEC->>EB: execution.completed
    EB->>ORCH: execution.completed
    ORCH->>ORCH: Verify outcome
    ORCH->>EB: work-item.resolved
    EB->>DASH: work-item.resolved
    EB->>KB: work-item.resolved (learn)
```

### Correlation Flow: Pattern Detection

```mermaid
sequenceDiagram
    participant ING as Ingestion
    participant EB as EventBridge
    participant CORR as Correlation
    participant DASH as Dashboard

    ING->>EB: work-item.created
    EB->>CORR: work-item.created
    CORR->>CORR: Rule Evaluator (temporal, causal, infra, repeat)
    CORR->>CORR: Session Manager (group open/update)
    alt Group threshold met
        CORR->>EB: correlation-group.detected
        EB->>DASH: correlation-group.detected
    else Session expires
        CORR->>CORR: Group Finalizer - close session
        CORR->>EB: correlation-group.updated
    end
```

## Cross-Context Event Registry

| Event | Producer | Consumers |
|-------|----------|-----------|
| `work-item.created` | Ingestion | Orchestration, Correlation, Dashboard, Audit |
| `triage.completed` | Orchestration | Dashboard, Audit |
| `plan.proposed` | Orchestration | Dashboard, Audit |
| `plan.approved` | Dashboard | Orchestration, Audit |
| `plan.rejected` | Dashboard | Orchestration, Audit |
| `execution.completed` | Execution | Orchestration, Dashboard, Audit |
| `execution.failed` | Execution | Orchestration, Dashboard, Communication, Audit |
| `verification.completed` | Orchestration | Dashboard, Knowledge Base, Audit |
| `work-item.resolved` | Orchestration | All contexts |
| `work-item.correlated` | Correlation | Orchestration, Dashboard, Audit |
| `correlation-group.detected` | Correlation | Dashboard, Orchestration, Audit |
| `correlation-group.updated` | Correlation | Dashboard, Audit |
| `runbook.generated` | Knowledge Base | Dashboard, Audit |
| `kb.updated` | Knowledge Base | Audit |
| `feedback.captured` | Knowledge Base | Orchestration, Audit |
| `feedback.summary-updated` | Orchestration | Dashboard, Audit |
| `circuit-breaker.tripped` | Platform | All contexts, Communication |
| `dlq.message-received` | Platform | Dashboard, Communication |
| `notification.sent` | Communication | Audit |
| `notification.failed` | Communication | Dashboard, Audit |
| `audit.entry-created` | Platform | Dashboard |
| `module.state-changed` | Dashboard | Orchestration, Communication |
| `skill.updated` | Dashboard | Orchestration, Audit |
| `steering.updated` | Dashboard | Orchestration, Audit |
| `approval.decision` | Dashboard | Orchestration, Audit |

## Relationship Types

- **Ingestion → Orchestration**: Upstream/Downstream (Conformist — Orchestration consumes Ingestion's events as-is)
- **Ingestion → Correlation**: Upstream/Downstream (Conformist — Correlation consumes work-item events)
- **Orchestration → Execution**: Partnership (co-evolve execution contract)
- **Orchestration ↔ Knowledge Base**: Partnership (query/response pattern + feedback loop)
- **Correlation → Orchestration**: Upstream/Downstream (correlation groups influence triage priority)
- **Dashboard → Orchestration**: Customer/Supplier (Dashboard drives approval workflow)
- **Platform → All**: Published Language (standard audit/circuit-breaker/DLQ events)
- **Communication → All**: Generic Subdomain (notification routing, no domain logic)

## Contract References

| Contract Type | Location | Description |
|--------------|----------|-------------|
| OpenAPI 3.1 | `contracts/api/openapi.yaml` | Dashboard REST API (Modules, Approvals, Executions, Audit, Agents) |
| Event Schemas | `contracts/events/{context}/*.schema.json` | 26 JSON Schema event definitions across 9 namespaces |
| Command Registry | `contracts/command-registry/{category}/*.json` | PowerShell command definitions for on-prem execution (AD, DNS, Services) |
| Correlation Rules | `contracts/correlation-rules/{type}/*.json` | Rule schemas for temporal, causal, infrastructure, and repeat patterns |
| Event Envelope | `contracts/events/common/event-envelope.schema.json` | Standard envelope wrapping all domain events |

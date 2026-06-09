# ForgeAdmin Context Map

## Visual Map

```
                    ┌──────────────────────────────────────────┐
                    │         PLATFORM FOUNDATION               │
                    │  EventBridge │ VPC │ Cognito │ IAM       │
                    └──────────────────────────────────────────┘
                                       │
                    ┌──────────────────────────────────────────┐
                    │          EVENTBRIDGE BUS                   │
                    │       (forgeadmin-events)                  │
                    └──────────────────────────────────────────┘
                      │        │        │        │        │
    ┌─────────────────┼────────┼────────┼────────┼────────┼──────────┐
    │                 │        │        │        │        │          │
    ▼                 ▼        ▼        ▼        ▼        ▼          ▼
┌────────┐     ┌──────────┐┌────────┐┌────────┐┌────────┐┌────────────┐
│INGESTION│     │ORCHESTR- ││EXECU-  ││KNOWL-  ││DASH-   ││COMMUNICA-  │
│         │     │ATION     ││TION    ││EDGE    ││BOARD   ││TION        │
│ServiceNow│    │          ││        ││BASE    ││& API   ││            │
│Email     │────▶ Triage   ││On-prem ││        ││        ││Teams/Slack │
│FortiSIEM │    │ Research ││bridge  ││Bedrock ││React   ││Email (SES) │
│          │    │ Planning ││SSM Run ││RAG     ││WebSock ││3-tier      │
│          │    │ Verify   ││Command ││        ││Cognito ││escalation  │
└────────┘     │ Supervise││        ││        ││        ││            │
               └──────────┘└────────┘└────────┘└────────┘└────────────┘
                      │                  │                      │
                      ▼                  ▼                      ▼
               ┌──────────────────────────────────────────────────┐
               │              PLATFORM SERVICES                     │
               │  Audit Trail │ Circuit Breaker │ Archival │ DLQ   │
               └──────────────────────────────────────────────────┘
```

## Event Flows

### Happy Path: Work Item → Resolution

```
Ingestion           Orchestration        Execution       Knowledge Base
    │                    │                    │                │
    │ work-item.created  │                    │                │
    │───────────────────▶│                    │                │
    │                    │                    │                │
    │                    │ (internal: triage) │                │
    │                    │ (internal: research)│               │
    │                    │                    │                │
    │                    │◀───────────────────│ kb.query.result│
    │                    │                    │                │
    │                    │ (internal: plan)   │                │
    │                    │                    │                │
    │                    │ plan.proposed ─────▶│ Dashboard      │
    │                    │◀──── plan.approved │                │
    │                    │                    │                │
    │                    │ execution.requested│                │
    │                    │───────────────────▶│                │
    │                    │                    │                │
    │                    │◀───────────────────│                │
    │                    │ execution.completed│                │
    │                    │                    │                │
    │                    │ (internal: verify) │                │
    │                    │                    │                │
    │                    │ work-item.resolved │                │
    │                    │───────────────────▶│ (all contexts) │
```

### Cross-Context Event Registry

| Event | Producer | Consumers |
|-------|----------|-----------|
| `work-item.created` | Ingestion | Orchestration, Dashboard, Audit |
| `triage.completed` | Orchestration | Dashboard, Audit |
| `plan.proposed` | Orchestration | Dashboard, Audit |
| `plan.approved` | Dashboard | Orchestration, Audit |
| `plan.rejected` | Dashboard | Orchestration, Audit |
| `execution.completed` | Execution | Orchestration, Dashboard, Audit |
| `execution.failed` | Execution | Orchestration, Dashboard, Communication, Audit |
| `verification.completed` | Orchestration | Dashboard, Knowledge Base, Audit |
| `work-item.resolved` | Orchestration | All contexts |
| `runbook.generated` | Knowledge Base | Dashboard, Audit |
| `kb.updated` | Knowledge Base | Audit |
| `circuit-breaker.tripped` | Platform | All contexts, Communication |
| `notification.sent` | Communication | Audit |
| `audit.entry-created` | Platform | Dashboard |
| `module.state-changed` | Dashboard | Orchestration, Communication |
| `approval.decision` | Dashboard | Orchestration, Audit |

## Relationship Types

- **Ingestion → Orchestration**: Upstream/Downstream (Conformist — Orchestration consumes Ingestion's events as-is)
- **Orchestration → Execution**: Partnership (co-evolve execution contract)
- **Orchestration ↔ Knowledge Base**: Partnership (query/response pattern)
- **Dashboard → Orchestration**: Customer/Supplier (Dashboard drives approval workflow)
- **Platform → All**: Published Language (standard audit/circuit-breaker events)
- **Communication → All**: Generic Subdomain (notification routing, no domain logic)
